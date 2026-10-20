try {
    if (window.destroyCubeModbus3D) {
        window.destroyCubeModbus3D();
    }

    // Extra safety: force-remove the 3D container (never leave a ghost image)
    const c = document.getElementById('cube-modbus-container');
    if (c && c.parentNode) c.parentNode.removeChild(c);
} catch(e) {}
