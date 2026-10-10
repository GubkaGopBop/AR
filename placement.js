// Hit-test poses and placed objects use the renderer's local-floor space.
export function applyHitPose(reticle, pose) {
  reticle.visible = Boolean(pose);
  if (pose) reticle.matrix.fromArray(pose.transform.matrix);
}

export function placeObject(object, reticle) {
  if (object.visible || !reticle.visible) return false;
  // Copy once: further marker or camera movement must not move the object.
  object.matrix.copy(reticle.matrix);
  object.matrixWorldNeedsUpdate = true;
  object.visible = true;
  reticle.visible = false;
  return true;
}
