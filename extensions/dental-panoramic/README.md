# @ohif/extension-dental-panoramic

Lab extension for OHIF (`/viewer`, mode basic / longitudinal): Romexis-style dental-arch curve and CPU curved-MPR panoramic.

- **Dibujar curva** — left click adds/inserts control points; right click finishes and reconstructs. Click the button again (or Esc) to leave the tool.
- **Editar curva** — drag handles or the green polyline; Ctrl adds/deletes. Click again or Esc to leave. Only this button stays highlighted in edit mode.
- **Espesor** — slider 1–40 mm (default 20) for the buccal–lingual slab. Changing it rebuilds the panoramic if a curve exists.
- Reconstruction uses `VoxelManager.sampleAtWorld` (trilinear), mean of the slab. Row 0 is superior (maxilla on top). Transversals / Autofit are out of scope.

Not a measurement tool (`PanoramicCurve.isAnnotation = false`). One active curve per study in this MVP.
