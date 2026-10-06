export default function middleware(request) {

    const password =
        process.env.SITE_PASSWORD;

    /*
        Leave the site open until SITE_PASSWORD is added
        in Vercel Project Settings.

        This lets the deployment continue working while
        the password is being configured.
    */

    if (!password) {
        return;
    }


    const authorization =
        request.headers.get(
            "authorization"
        );


    if (!authorization) {

        return new Response(
            "Password required.",
            {
                status: 401,

                headers: {
                    "WWW-Authenticate":
                        'Basic realm="Video Watcher"'
                }
            }
        );

    }


    const parts =
        authorization.split(" ");


    if (
        parts.length !== 2 ||
        parts[0] !== "Basic"
    ) {

        return new Response(
            "Password required.",
            {
                status: 401,

                headers: {
                    "WWW-Authenticate":
                        'Basic realm="Video Watcher"'
                }
            }
        );

    }


    let decoded = "";

    try {

        decoded =
            atob(
                parts[1]
            );

    } catch (error) {

        return new Response(
            "Password required.",
            {
                status: 401,

                headers: {
                    "WWW-Authenticate":
                        'Basic realm="Video Watcher"'
                }
            }
        );

    }


    const separator =
        decoded.indexOf(":");


    const suppliedPassword =
        separator >= 0
            ? decoded.slice(
                separator + 1
            )
            : "";


    if (
        suppliedPassword !==
        password
    ) {

        return new Response(
            "Incorrect password.",
            {
                status: 401,

                headers: {
                    "WWW-Authenticate":
                        'Basic realm="Video Watcher"'
                }
            }
        );

    }


    return;
}


export const config = {
    matcher: [
        "/(.*)"
    ]
};
