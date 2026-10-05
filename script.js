const OWNER = "dmrman12345";
const REPOSITORY = "project-4f82a1";

const statusElement = document.getElementById("status");
const githubStatus = document.getElementById("githubStatus");
const fileOutput = document.getElementById("fileOutput");


async function testGitHub() {

    statusElement.textContent =
        "Testing GitHub API connection...";

    const apiURL =
        "https://api.github.com/repos/" +
        OWNER +
        "/" +
        REPOSITORY +
        "/contents/";


    try {

        const response = await fetch(apiURL, {
            headers: {
                "Accept": "application/vnd.github+json"
            }
        });


        if (!response.ok) {

            throw new Error(
                "GitHub returned HTTP " +
                response.status
            );

        }


        const files = await response.json();


        githubStatus.textContent =
            "GitHub API connection: SUCCESS";


        statusElement.textContent =
            "Code.org successfully reached GitHub.";


        if (!Array.isArray(files)) {

            fileOutput.textContent =
                JSON.stringify(files, null, 2);

            return;
        }


        if (files.length === 0) {

            fileOutput.textContent =
                "Repository is empty.\n\n" +
                "That's OK! GitHub API access is working.";

            return;
        }


        fileOutput.textContent =
            "Files found:\n\n" +
            files.map(file =>
                file.name +
                " (" +
                file.type +
                ")"
            ).join("\n");


    } catch (error) {

        githubStatus.textContent =
            "GitHub API connection: FAILED";

        statusElement.textContent =
            "Something blocked the GitHub request.";

        fileOutput.textContent =
            error.toString();

        console.error(error);

    }

}


testGitHub();
