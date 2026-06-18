const AlbaAuth = (() => {

    ```
    let session = null;

    function requireLogin() {

        const saved = localStorage.getItem("atprotoSession");

        if (!saved) {
            window.location.href = "../../";
            return false;
        }

        try {

            session = JSON.parse(saved);

            if (!session.did || !session.jwt || !session.handle) {

                localStorage.removeItem("atprotoSession");
                window.location.href = "../../";

                return false;
            }

            return true;

        } catch(err) {

            localStorage.removeItem("atprotoSession");
            window.location.href = "../../";

            return false;
        }
    }

    function getSession() {

        if (!session) {

            const saved = localStorage.getItem("atprotoSession");

            if (saved) {
                session = JSON.parse(saved);
            }
        }

        return session;
    }

    function getHandle() {

        const s = getSession();

        return s ? s.handle : null;
    }

    function getDid() {

        const s = getSession();

        return s ? s.did : null;
    }

    function getJwt() {

        const s = getSession();

        return s ? s.jwt : null;
    }

    function logout() {

        localStorage.removeItem("atprotoSession");

        window.location.href = "../../";
    }

    function updateUserStatus(elementId = "userStatus") {

        const element = document.getElementById(elementId);

        if (!element) return;

        const s = getSession();

        if (!s) {
            element.textContent = "Sin sesión";
            return;
        }

        element.textContent = `Conectado como: ${s.handle}`;
    }

    async function authenticatedFetch(url, options = {}) {

        const jwt = getJwt();

        if (!jwt) {
            throw new Error("No existe sesión activa");
        }

        const headers = {
            ...(options.headers || {}),
                  Authorization: `Bearer ${jwt}`
        };

        return fetch(url, {
            ...options,
            headers
        });
    }

    return {
        requireLogin,
        getSession,
        getHandle,
        getDid,
        getJwt,
        logout,
        updateUserStatus,
        authenticatedFetch
    };
    ```

})();
