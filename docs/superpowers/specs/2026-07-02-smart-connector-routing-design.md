# Smart connector routing — design

**Issue:** [#17](https://github.com/leimingyu/quickdraw/issues/17) — "Smart connector routing"
**Date:** 2026-07-02

## Problem

Two flaws in how connectors meet shapes today (`src/render/connector.ts`):

1. **Ends target discrete connection points, not the true outline.** An auto-snap
   (unanchored) attached end snaps to whichever of the shape's **8 handle points**
   (corners + edge midpoints) faces the other end (`nearestPoint`). Those handles are
   *bounding-box* points, so for an ellipse/diamond/triangle the arrow floats off the
   real outline (corners) or meets it at the wrong spot. Even for a rect, a diagonal
   connector jumps to the nearest corner instead of touching where the line actually
   crosses the edge.

2. **Elbow routing is a naive midpoint split.** `elbowRoute` builds a 4-point Z that
   splits at the geometric midpoint of the segment along the dominant axis, with no
   awareness of the shapes it leaves. It can exit at a shallow angle and slice back
   through the source or target shape.

## Scope (agreed)

**Clip to the true edge + smart elbow — no avoidance of unrelated (third) shapes.**

- Clip each auto-snap connector end to the shape's real outline
  (rect/rounded/text = box, ellipse, diamond, triangle), rotation-aware.
- Rewrite elbow routing to leave each end **perpendicular** to the edge it clips to
  (a short stub) and connect the stubs with an L or Z that does not cut back through
  the two connected shapes.

**Out of scope:** grid/A\* pathfinding around other shapes sitting between the two
endpoints; curved/straight routing changes beyond the automatic benefit of clipped
ends; changing pinned-anchor behavior.

## Design

### 1. Edge clipping — `clipToOutline` (new, `src/model/geometry.ts`)

Pure geometry, so it lives with the other shape math.

```
clipToOutline(s: Shape, toward: Point): Point
```

Returns the point where the ray from the shape's **center** toward `toward` crosses the
shape's outline. Rotation-aware: transform `toward` into the shape's unrotated (local)
frame around the center, compute the boundary offset there, rotate the offset back.

Per kind, given a center-relative direction `(dx, dy)` in the local frame and half-extents
`rx = w/2`, `ry = h/2`, the outward offset to the boundary is:

- **rect / rounded / text** (box): `t = 1 / max(|dx|/rx, |dy|/ry)` → `(dx·t, dy·t)`.
  (Rounded corners' 12px radius is ignored — negligible.)
- **ellipse:** `t = 1 / hypot(dx/rx, dy/ry)` → `(dx·t, dy·t)`.
- **diamond:** `t = 1 / (|dx|/rx + |dy|/ry)` → `(dx·t, dy·t)`.
- **triangle:** ray-vs-polygon. Local vertices (center-relative): apex `(0, -ry)`,
  base-right `(rx, ry)`, base-left `(-rx, ry)`. Return the edge intersection with the
  smallest positive ray parameter.

Degenerate guard: if `toward` equals the center (`dx == dy == 0`), return the center.

The box-center is inside all four shapes (verified for the triangle: at mid-height the
triangle spans `[cx−rx/2, cx+rx/2]`, which contains `cx`), so a ray from the center always
exits through exactly one boundary.

### 2. Exit normals

For smart elbow, each attached end needs an **outward orthogonal exit direction** (a unit
vector, axis-aligned):

- **Auto-snap end:** derived from the clip offset side. With local offset `(ox, oy)` and
  half-extents `(rx, ry)`: horizontal exit `(sign(ox), 0)` if `|ox|/rx ≥ |oy|/ry`, else
  vertical `(0, sign(oy))`. Rotate by the shape's rotation.
- **Pinned anchor:** edge anchors map to their normal (`n→(0,−1)`, `s→(0,1)`, `e→(1,0)`,
  `w→(−1,0)`); a corner anchor picks the axis (x or y) along which `toward` is farther,
  signed outward. Rotate by the shape's rotation.
- **Floating end:** no normal (undefined).

### 3. Smart elbow — `elbowRoute(seg, dir1?, dir2?)` (`src/render/connector.ts`)

Backward-compatible signature: **with no directions, behavior is unchanged** (the current
naive midpoint Z), which keeps the pure `elbowRoute(seg)` unit tests green and gives a sane
route when both ends float.

With directions:

1. Stub each end outward by `S` world units along its normal: `a1 = p1 + dir1·S`,
   `a2 = p2 + dir2·S` (a missing dir is derived from the segment's dominant axis).
2. Connect `a1`→`a2` orthogonally by dir orientation:
   - both horizontal → Z at mid-x: `[a1, {mx, a1.y}, {mx, a2.y}, a2]`
   - both vertical → Z at mid-y: `[a1, {a1.x, my}, {a2.x, my}, a2]`
   - mixed → L corner: dir1 horizontal → `[a1, {a2.x, a1.y}, a2]`; dir1 vertical →
     `[a1, {a1.x, a2.y}, a2]`
3. Full route: `[p1, ...connect(a1, a2)..., p2]`.

`S` is a small fixed stub (≈16 world units). The stub guarantees the connector leaves the
shape straight before turning, so it never immediately clips the shape it exits.

### 4. Wiring (`src/render/connector.ts`)

Introduce one resolver used everywhere so canvas, hit-test, and SVG export stay identical:

- `connectorEnds(tab, c)` → `{ p1, p2, dir1?, dir2? }`. Attached ends go through the
  clip/anchor + normal logic; floating ends pass through with no dir.
- `connectorSegment(tab, c)` derives `{x1,y1,x2,y2}` from `connectorEnds` — **API
  unchanged**, so all existing seg-based callers (endpoint handles, curve/line render,
  hit-test) keep working, now with clipped ends.
- `connectorRoute(tab, c)` passes the ends' dirs into `elbowRoute` for elbow routing;
  straight/curved are unchanged and automatically benefit from clipped endpoints.
- `connectorToSvg` elbow branch builds its polyline from the same route (via
  `connectorEnds`/`elbowRoute`) so the drawn path matches `connectorRoute` exactly.

Both the live canvas (`Renderer`) and SVG/PNG export flow through `connectorToSvg`, so no
export-specific change is needed.

## Data flow

```
connectorEnds(tab,c) ── attached? ──▶ clipToOutline + exit normal  (auto-snap)
                     │                 anchor handle + anchor normal (pinned)
                     └── floating ──▶ point as-is, no normal
        │
        ├─▶ connectorSegment  → {x1,y1,x2,y2}  (handles, curve/line render, hit tolerance)
        └─▶ connectorRoute     → straight (2pts) | curved (17pts) | elbow (smart, dirs)
                                    │
                          connectorToSvg / connectorHit consume the route
```

## Testing

New unit tests:

- **`clipToOutline`** (`tests/model/geometry.test.ts`): rect edge & diagonal, ellipse,
  diamond, triangle, a rotated shape, and the center-degenerate guard. Assert the returned
  point lies on the outline and on the center→toward ray.
- **Smart elbow** (`tests/render/connector-elbow.test.ts`): perpendicular exits (first and
  last legs are axis-aligned along the normals); an aligned pair gives a clean Z whose first
  leg leaves horizontally; `elbowRoute(seg)` with no dirs still returns the naive 4-point Z
  (unchanged).
- **Clipped ends** (`tests/render/connector-geometry.test.ts`): a diagonal rect pair clips
  to the true edge (updates the old "re-snaps to a corner" test); an ellipse end sits on the
  ellipse outline, not its bounding box.

Regression: full `npm test` + `npm run build` (typecheck) must stay green. The only existing
test whose expectation changes is the diagonal "corner" case in `connector-geometry.test.ts`,
which is precisely the behavior the issue asks to fix.

## Risks / trade-offs

- **One behavior change:** diagonal auto-snap ends now land on the true edge instead of a
  corner handle — intended by the issue; pinned anchors are untouched.
- **Very close/overlapping shapes:** stubs could overshoot past each other and produce a
  small kink; acceptable for v1 and no worse than today. `S` stays small to limit this.
- **No third-shape avoidance:** an elbow may still cross an unrelated shape between the
  endpoints — explicitly out of scope per the agreed approach.
