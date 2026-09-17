# @ohif/extension-dental-panoramic

Lab extension for OHIF (`/viewer`, mode basic / longitudinal): Romexis-style dental-arch curve and CPU curved-MPR panoramic.

The panoramic actions are grouped in a split toolbar button: the active curve action remains available as the primary button, while drawing, editing, thickness, and clearing are available from its dropdown.

- **Dibujar curva** — left click adds/inserts control points; right click finishes and reconstructs. Click the button again (or Esc) to leave the tool.
- **Editar curva** — drag handles or the green polyline; Ctrl adds/deletes. Click again or Esc to leave. Only this button stays highlighted in edit mode.
- Control points are hidden after the panoramic is generated. Choosing **Editar curva** shows them again: dragging a point changes only that point, while dragging the centerline moves the complete curve.
- **Espesor** — slider 1–40 mm (default 20) for the buccal–lingual slab. Every change, including the final value when the slider is released, rebuilds the panoramic from the last valid curve.
- The axial viewport displays that thickness as a translucent band bounded by dashed lines around the green curve, updating with the slider.
- **Limpiar curva** — removes the control curve and its derived panoramic viewport so a new curve can be traced cleanly.
- Curve edits are debounced and use latest-change-wins semantics, so moving, adding, or deleting a control point refreshes the derived panoramic without allowing an older reconstruction to replace it.
- Moving the complete curve changes its world-space position over the source volume; the derived `StackViewport` is then replaced with the newly sampled voxel image.
- Reconstruction uses `VoxelManager.sampleAtWorld` (trilinear), mean of the slab. Row 0 is superior (maxilla on top). Transversals / Autofit are out of scope.
- The reconstructed image spans the full superior–inferior extent of the source volume; it is not limited to a fixed strip around the drawn curve.

Not a measurement tool (`PanoramicCurve.isAnnotation = false`). One active curve per study in this MVP.
