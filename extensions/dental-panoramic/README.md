# @ohif/extension-dental-panoramic

Lab extension for OHIF (`/viewer`, mode basic / longitudinal): Romexis-style dental-arch curve and CPU curved-MPR panoramic.

The panoramic actions are grouped in a split toolbar button: the active curve action remains available as the primary button, while drawing, editing, thickness, and clearing are available from its dropdown.

- **Dibujar curva** — left click adds/inserts control points; right click finishes and reconstructs. Click the button again (or Esc) to leave the tool.
- **Editar curva** — drag handles or the green polyline; Ctrl adds/deletes. Click again or Esc to leave. Only this button stays highlighted in edit mode.
- Control points are hidden after the panoramic is generated. Choosing **Editar curva** shows them again: dragging a point changes only that point, while dragging the centerline moves the complete curve.
- **Espesor** — slider 1–40 mm (default 20) for the buccal–lingual slab. Changes rebuild after a short idle delay, or are deferred until exit when curve editing is active.
- **Nitidez** — slider 0–100% (default 0) applying a 3×3 Gaussian unsharp mask to the reconstructed pixels; 0% preserves the original result.
- The axial viewport displays that thickness as a translucent band bounded by dashed lines around the green curve, updating with the slider.
- **Limpiar curva** — removes the control curve and its derived panoramic viewport so a new curve can be traced cleanly.
- Edit mode never reconstructs while it is active, so any number of control points can be moved continuously. Leaving edit mode (toolbar toggle or `Esc`) starts one reconstruction from the final curve.
- Point and whole-curve drags update the axial overlay at animation-frame speed without starting the expensive panoramic reconstruction during the edit session.
- While drawing or editing, `Ctrl + click` on the rendered curve inserts a control point between its neighbours (`Ctrl + click` on an existing handle removes it).
- Moving the complete curve changes its world-space position over the source volume; the derived `StackViewport` is then replaced with the newly sampled voxel image.
- Reconstruction uses `VoxelManager.sampleAtWorld` (trilinear), mean of the slab. Row 0 is superior (maxilla on top). Transversals / Autofit are out of scope.
- The reconstructed image spans the full superior–inferior extent of the source volume; it is not limited to a fixed strip around the drawn curve.

Not a measurement tool (`PanoramicCurve.isAnnotation = false`). One active curve per study in this MVP.
