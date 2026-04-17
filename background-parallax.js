(() => {
  const root = document.documentElement;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");
  const mobileViewport = window.matchMedia("(max-width: 900px)");

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let rafId = 0;
  let gyroBound = false;

  function applyPosition() {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;
    root.style.setProperty("--bg-shift-x", `${currentX.toFixed(2)}px`);
    root.style.setProperty("--bg-shift-y", `${currentY.toFixed(2)}px`);

    if (Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05) {
      rafId = window.requestAnimationFrame(applyPosition);
    } else {
      rafId = 0;
    }
  }

  function schedule() {
    if (!rafId) rafId = window.requestAnimationFrame(applyPosition);
  }

  function setTarget(x, y) {
    targetX = x;
    targetY = y;
    schedule();
  }

  function resetTarget() {
    setTarget(0, 0);
  }

  function bindPointerParallax() {
    window.addEventListener("mousemove", (event) => {
      if (prefersReducedMotion.matches || mobileViewport.matches || !finePointer.matches) return;
      const xRatio = event.clientX / window.innerWidth - 0.5;
      const yRatio = event.clientY / window.innerHeight - 0.5;
      setTarget(xRatio * 36, yRatio * 28);
    }, { passive: true });

    window.addEventListener("mouseleave", resetTarget, { passive: true });
  }

  function bindGyroParallax() {
    if (gyroBound || !("DeviceOrientationEvent" in window)) return;
    gyroBound = true;

    window.addEventListener("deviceorientation", (event) => {
      if (!mobileViewport.matches || prefersReducedMotion.matches) return;
      const gamma = Math.max(-18, Math.min(18, event.gamma ?? 0));
      const beta = Math.max(-18, Math.min(18, event.beta ?? 0));
      setTarget(gamma * 0.28, beta * 0.22);
    }, { passive: true });
  }

  function tryEnableGyro() {
    if (!mobileViewport.matches || prefersReducedMotion.matches) return;
    const permissionAPI = window.DeviceOrientationEvent && window.DeviceOrientationEvent.requestPermission;
    if (typeof permissionAPI === "function") {
      permissionAPI.call(window.DeviceOrientationEvent)
        .then((state) => {
          if (state === "granted") bindGyroParallax();
        })
        .catch(() => {});
      return;
    }
    bindGyroParallax();
  }

  bindPointerParallax();
  window.addEventListener("pointerdown", tryEnableGyro, { passive: true, once: true });
  window.addEventListener("touchstart", tryEnableGyro, { passive: true, once: true });
  window.addEventListener("resize", resetTarget, { passive: true });

  if (!mobileViewport.matches) {
    resetTarget();
  }
})();
