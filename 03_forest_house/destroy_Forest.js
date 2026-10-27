try {
    if (window.destroyForest3D) {
        window.destroyForest3D();
    }

    // Extra safety: force-remove the 3D container (never leave a ghost image)
    const c = document.getElementById('forest-3d-container');
    if (c && c.parentNode) c.parentNode.removeChild(c);
} catch(e) {}
