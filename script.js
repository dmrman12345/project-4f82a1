/* ============================================================
   CODETUBE
   Main frontend + efficient MSE streaming engine
============================================================ */

"use strict";


/* ============================================================
   CONFIGURATION
============================================================ */

const BACKEND =
    "https://codetube-backend.vercel.app";

const CACHE_ENDPOINT =
    BACKEND + "/api/cache-file";

const SEARCH_ENDPOINT =
    BACKEND + "/api/search.py";

const VIDEO_ENDPOINT =
    BACKEND + "/api/video";


/*
    Streaming settings.

    These deliberately keep the player from downloading
    the entire video immediately.
*/

const INITIAL_BUFFER_SECONDS = 12;

const TARGET_BUFFER_SECONDS = 28;

const LOW_BUFFER_SECONDS = 8;

const MAX_BUFFER_SECONDS = 35;

const MAX_DOWNLOAD_RETRIES = 3;


/* ============================================================
   DOM REFERENCES
============================================================ */

const body =
    document.body;

const menuButton =
    document.getElementById("menuButton");

const sidebar =
    document.getElementById("sidebar");

const homeLogo =
    document.getElementById("homeLogo");

const searchInput =
    document.getElementById("searchInput");

const searchButton =
    document.getElementById("searchButton");

const videoGrid =
    document.getElementById("videoGrid");

const searchResults =
    document.getElementById("searchResults");

const searchHeading =
    document.getElementById("searchHeading");

const youtubePlayer =
    document.getElementById("youtubePlayer");

const playerShell =
    document.getElementById("playerShell");

const playerLoading =
    document.getElementById("playerLoading");

const playerError =
    document.getElementById("playerError");

const playerErrorText =
    document.getElementById("playerErrorText");

const retryButton =
    document.getElementById("retryButton");

const watchTitle =
    document.getElementById("watchTitle");

const watchChannel =
    document.getElementById("watchChannel");

const watchDescription =
    document.getElementById("watchDescription");

const channelAvatar =
    document.getElementById("channelAvatar");

const relatedVideos =
    document.getElementById("relatedVideos");

const historyGrid =
    document.getElementById("historyGrid");

const watchLaterGrid =
    document.getElementById("watchLaterGrid");

const clearHistoryButton =
    document.getElementById("clearHistoryButton");

const watchLaterButton =
    document.getElementById("watchLaterButton");

const likeButton =
    document.getElementById("likeButton");

const dislikeButton =
    document.getElementById("dislikeButton");

const shareButton =
    document.getElementById("shareButton");

const subscribeButton =
    document.getElementById("subscribeButton");

const toast =
    document.getElementById("toast");


/* ============================================================
   APPLICATION STATE
============================================================ */

const state = {

    currentPage:
        "home",

    currentVideo:
        null,

    lastSearch:
        "",

    searchRequestId:
        0,

    videoRequestId:
        0,

    history:
        loadStorage(
            "codetube-history",
            []
        ),

    watchLater:
        loadStorage(
            "codetube-watch-later",
            []
        ),

    likes:
        loadStorage(
            "codetube-likes",
            {}
        ),

    subscriptions:
        loadStorage(
            "codetube-subscriptions",
            {}
        )

};


/* ============================================================
   MSE STREAMING ENGINE
============================================================ */

const streamer = {

    mediaSource:
        null,

    videoSourceBuffer:
        null,

    audioSourceBuffer:
        null,

    manifest:
        null,

    videoId:
        null,

    objectUrl:
        null,

    abortController:
        null,

    generation:
        0,

    videoNextIndex:
        0,

    audioNextIndex:
        0,

    downloadedVideo:
        new Set(),

    downloadedAudio:
        new Set(),

    downloading:
        false,

    initialized:
        false,

    ended:
        false,

    waitingForSeek:
        false,

    pendingSeek:
        null,

    lastSavedTime:
        0

};


/* ============================================================
   STORAGE
============================================================ */

function loadStorage(
    key,
    fallback
) {

    try {

        const value =
            localStorage.getItem(
                key
            );

        if (!value) {
            return fallback;
        }

        const parsed =
            JSON.parse(value);

        return parsed;

    } catch (error) {

        console.warn(
            "Storage read failed:",
            error
        );

        return fallback;
    }

}


function saveStorage(
    key,
    value
) {

    try {

        localStorage.setItem(
            key,
            JSON.stringify(value)
        );

    } catch (error) {

        console.warn(
            "Storage write failed:",
            error
        );

    }

}


/* ============================================================
   TOAST
============================================================ */

let toastTimer =
    null;


function showToast(
    message
) {

    toast.textContent =
        message;

    toast.classList.add(
        "show"
    );

    clearTimeout(
        toastTimer
    );

    toastTimer =
        setTimeout(
            function() {

                toast.classList.remove(
                    "show"
                );

            },
            2400
        );

}


/* ============================================================
   PAGE NAVIGATION
============================================================ */

const pages = {

    home:
        document.getElementById(
            "homePage"
        ),

    search:
        document.getElementById(
            "searchPage"
        ),

    watch:
        document.getElementById(
            "watchPage"
        ),

    history:
        document.getElementById(
            "historyPage"
        ),

    watchlater:
        document.getElementById(
            "watchLaterPage"
        ),

    other:
        document.getElementById(
            "otherPage"
        )

};


function showPage(
    pageName
) {

    Object.values(
        pages
    ).forEach(
        function(page) {

            page.classList.remove(
                "active-page"
            );

        }
    );


    if (
        pages[pageName]
    ) {

        pages[pageName].classList.add(
            "active-page"
        );

    }


    state.currentPage =
        pageName;


    window.scrollTo(
        {
            top: 0,
            behavior: "instant"
        }
    );


    document
        .querySelectorAll(
            ".sidebar-item"
        )
        .forEach(
            function(item) {

                item.classList.toggle(
                    "active",
                    item.dataset.page ===
                        pageName
                );

            }
        );


    if (
        pageName ===
        "history"
    ) {

        renderHistory();

    }


    if (
        pageName ===
        "watchlater"
    ) {

        renderWatchLater();

    }

}


/* ============================================================
   SIDEBAR
============================================================ */

menuButton.addEventListener(
    "click",
    function() {

        if (
            window.innerWidth <=
            800
        ) {

            body.classList.toggle(
                "sidebar-mobile-open"
            );

        } else {

            body.classList.toggle(
                "sidebar-collapsed"
            );

        }

    }
);


document
    .querySelectorAll(
        ".sidebar-item"
    )
    .forEach(
        function(item) {

            item.addEventListener(
                "click",
                function() {

                    const page =
                        item.dataset.page;

                    body.classList.remove(
                        "sidebar-mobile-open"
                    );


                    if (
                        page ===
                        "home"
                    ) {

                        showPage(
                            "home"
                        );

                        return;

                    }


                    if (
                        page ===
                        "history"
                    ) {

                        showPage(
                            "history"
                        );

                        return;

                    }


                    if (
                        page ===
                        "watchlater"
                    ) {

                        showPage(
                            "watchlater"
                        );

                        return;

                    }


                    const title =
                        capitalize(
                            page
                        );

                    document
                        .getElementById(
                            "otherPageTitle"
                        )
                        .textContent =
                        title;


                    document
                        .getElementById(
                            "otherPageText"
                        )
                        .textContent =
                        "This CodeTube section is ready for future features.";


                    showPage(
                        "other"
                    );

                }
            );

        }
    );


homeLogo.addEventListener(
    "click",
    function() {

        showPage(
            "home"
        );

    }
);


/* ============================================================
   SEARCH
============================================================ */

searchButton.addEventListener(
    "click",
    function() {

        performSearch(
            searchInput.value.trim()
        );

    }
);


searchInput.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key ===
            "Enter"
        ) {

            performSearch(
                searchInput.value.trim()
            );

        }

    }
);


async function performSearch(
    query
) {

    query =
        query.trim();


    if (!query) {

        showPage(
            "home"
        );

        return;

    }


    state.lastSearch =
        query;


    const requestId =
        ++state.searchRequestId;


    showPage(
        "search"
    );


    searchHeading.textContent =
        'Search results for "' +
        query +
        '"';


    searchResults.innerHTML =
        createSearchSkeletons();


    try {

        const url =
            SEARCH_ENDPOINT +
            "?q=" +
            encodeURIComponent(
                query
            );


        const response =
            await fetch(
                url,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Search request failed: HTTP " +
                response.status
            );

        }


        const data =
            await response.json();


        if (
            requestId !==
            state.searchRequestId
        ) {

            return;

        }


        const videos =
            Array.isArray(
                data.videos
            )
                ? data.videos
                : [];


        renderSearchResults(
            videos
        );


    } catch (error) {

        console.error(
            error
        );


        searchResults.innerHTML =
            createErrorMessage(
                "Search failed",
                error.message
            );

    }

}


/* ============================================================
   CATEGORIES
============================================================ */

document
    .querySelectorAll(
        ".category"
    )
    .forEach(
        function(button) {

            button.addEventListener(
                "click",
                function() {

                    document
                        .querySelectorAll(
                            ".category"
                        )
                        .forEach(
                            function(item) {

                                item.classList.remove(
                                    "active"
                                );

                            }
                        );


                    button.classList.add(
                        "active"
                    );


                    const query =
                        button.dataset.query;


                    if (!query) {

                        showPage(
                            "home"
                        );

                        return;

                    }


                    performSearch(
                        query
                    );

                }
            );

        }
    );


/* ============================================================
   HOME
============================================================ */

async function loadHome() {

    videoGrid.innerHTML =
        createSkeletons(
            12
        );


    try {

        const response =
            await fetch(
                SEARCH_ENDPOINT +
                "?q=" +
                encodeURIComponent(
                    "popular"
                ),
                {
                    cache:
                        "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "HTTP " +
                response.status
            );

        }


        const data =
            await response.json();


        const videos =
            Array.isArray(
                data.videos
            )
                ? data.videos
                : [];


        if (
            videos.length
        ) {

            renderVideoGrid(
                videoGrid,
                videos
            );

        } else {

            videoGrid.innerHTML =
                createEmptyMessage(
                    "No videos found yet."
                );

        }

    } catch (error) {

        console.error(
            error
        );


        videoGrid.innerHTML =
            createErrorMessage(
                "Couldn't load CodeTube",
                error.message
            );

    }

}


/* ============================================================
   THUMBNAILS
============================================================ */

function thumbnailUrl(
    video
) {

    if (
        video.thumbnail
    ) {

        return video.thumbnail;

    }


    if (
        video.thumbnails &&
        video.thumbnails.high
    ) {

        return video.thumbnails.high.url;

    }


    if (
        video.videoId
    ) {

        return (
            "https://i.ytimg.com/vi/" +
            encodeURIComponent(
                video.videoId
            ) +
            "/hqdefault.jpg"
        );

    }


    return "";

}


/* ============================================================
   VIDEO CARDS
============================================================ */

function renderVideoGrid(
    container,
    videos
) {

    container.innerHTML =
        "";


    videos.forEach(
        function(video) {

            const card =
                createVideoCard(
                    video
                );

            container.appendChild(
                card
            );

        }
    );

}


function createVideoCard(
    video
) {

    const card =
        document.createElement(
            "article"
        );


    card.className =
        "video-card";


    const image =
        thumbnailUrl(
            video
        );


    card.innerHTML =

        '<div class="thumbnail-wrapper">' +

            (
                image
                    ? (
                        '<img src="' +
                        escapeAttribute(
                            image
                        ) +
                        '" alt="" loading="lazy">'
                    )
                    : ""
            ) +

        '</div>' +

        '<div class="video-card-info">' +

            '<div class="video-avatar">' +
                'C' +
            '</div>' +

            '<div class="video-text">' +

                '<h3 class="video-title">' +
                    escapeHtml(
                        video.title ||
                        "Untitled video"
                    ) +
                '</h3>' +

                '<div class="video-channel">' +
                    escapeHtml(
                        video.channel ||
                        "Unknown channel"
                    ) +
                '</div>' +

                (
                    video.description
                        ? (
                            '<div class="video-description">' +
                            escapeHtml(
                                video.description
                            ) +
                            '</div>'
                        )
                        : ""
                ) +

            '</div>' +

        '</div>';


    card.addEventListener(
        "click",
        function() {

            openVideo(
                video
            );

        }
    );


    return card;

}


/* ============================================================
   SEARCH RESULTS RENDERER
============================================================ */

function renderSearchResults(
    videos
) {

    searchResults.innerHTML =
        "";


    if (
        !videos.length
    ) {

        searchResults.innerHTML =
            createEmptyMessage(
                "No videos matched your search."
            );

        return;

    }


    videos.forEach(
        function(video) {

            const item =
                document.createElement(
                    "article"
                );


            item.className =
                "search-result";


            const image =
                thumbnailUrl(
                    video
                );


            item.innerHTML =

                '<div class="search-result-thumbnail">' +

                    (
                        image
                            ? (
                                '<img src="' +
                                escapeAttribute(
                                    image
                                ) +
                                '" alt="" loading="lazy">'
                            )
                            : ""
                    ) +

                '</div>' +

                '<div class="search-result-info">' +

                    '<h2 class="search-result-title">' +
                        escapeHtml(
                            video.title ||
                            "Untitled video"
                        ) +
                    '</h2>' +

                    '<div class="search-result-channel">' +
                        escapeHtml(
                            video.channel ||
                            "Unknown channel"
                        ) +
                    '</div>' +

                    (
                        video.description
                            ? (
                                '<p class="search-result-description">' +
                                escapeHtml(
                                    video.description
                                ) +
                                '</p>'
                            )
                            : ""
                    ) +

                '</div>';


            item.addEventListener(
                "click",
                function() {

                    openVideo(
                        video
                    );

                }
            );


            searchResults.appendChild(
                item
            );

        }
    );

}


/* ============================================================
   OPEN VIDEO
============================================================ */

async function openVideo(
    video
) {

    if (
        !video ||
        !video.videoId
    ) {

        showToast(
            "This video does not have a valid ID."
        );

        return;

    }


    const requestId =
        ++state.videoRequestId;


    stopStreaming();


    state.currentVideo =
        video;


    showPage(
        "watch"
    );


    updateWatchInfo(
        video
    );


    playerError.classList.add(
        "hidden"
    );

    playerLoading.classList.remove(
        "hidden"
    );


    saveToHistory(
        video
    );


    try {

        let metadata =
            video;


        try {

            const response =
                await fetch(
                    VIDEO_ENDPOINT +
                    "?id=" +
                    encodeURIComponent(
                        video.videoId
                    ),
                    {
                        cache:
                            "no-store"
                    }
                );


            if (
                response.ok
            ) {

                const data =
                    await response.json();


                if (
                    data &&
                    data.success
                ) {

                    metadata = {
                        ...video,
                        ...data
                    };

                    state.currentVideo =
                        metadata;

                    updateWatchInfo(
                        metadata
                    );

                }

            }

        } catch (metadataError) {

            console.warn(
                "Metadata request failed:",
                metadataError
            );

        }


        if (
            requestId !==
            state.videoRequestId
        ) {

            return;

        }


        await startStreaming(
            state.currentVideo
        );


        renderRelated(
            state.currentVideo
        );


    } catch (error) {

        console.error(
            error
        );


        if (
            requestId !==
            state.videoRequestId
        ) {

            return;

        }


        showPlayerError(
            error.message ||
            String(error)
        );

    }

}


/* ============================================================
   WATCH INFO
============================================================ */

function updateWatchInfo(
    video
) {

    watchTitle.textContent =
        video.title ||
        "Untitled video";


    watchChannel.textContent =
        video.channel ||
        "Unknown channel";


    channelAvatar.textContent =
        getInitial(
            video.channel ||
            "C"
        );


    watchDescription.textContent =
        video.description ||
        "No description available.";


    updateWatchLaterButton();

    updateLikeButton();

    updateSubscribeButton();

}


/* ============================================================
   STREAMING
============================================================ */

async function startStreaming(
    video
) {

    if (
        !window.MediaSource
    ) {

        throw new Error(
            "This browser does not support MediaSource playback."
        );

    }


    stopStreaming();


    streamer.generation++;


    const generation =
        streamer.generation;


    streamer.videoId =
        video.videoId;


    streamer.abortController =
        new AbortController();


    streamer.downloadedVideo =
        new Set();


    streamer.downloadedAudio =
        new Set();


    streamer.videoNextIndex =
        0;


    streamer.audioNextIndex =
        0;


    streamer.downloading =
        false;

    streamer.initialized =
        false;

    streamer.ended =
        false;


    const manifest =
        await fetchManifest(
            video.videoId,
            streamer.abortController.signal
        );


    if (
        generation !==
        streamer.generation
    ) {

        return;

    }


    streamer.manifest =
        manifest;


    const videoMime =
        'video/mp4; codecs="' +
        manifest.videoCodec +
        '"';


    const audioMime =
        'audio/mp4; codecs="' +
        manifest.audioCodec +
        '"';


    if (
        !MediaSource.isTypeSupported(
            videoMime
        )
    ) {

        throw new Error(
            "The browser does not support " +
            videoMime
        );

    }


    if (
        !MediaSource.isTypeSupported(
            audioMime
        )
    ) {

        throw new Error(
            "The browser does not support " +
            audioMime
        );

    }


    streamer.mediaSource =
        new MediaSource();


    streamer.objectUrl =
        URL.createObjectURL(
            streamer.mediaSource
        );


    youtubePlayer.src =
        streamer.objectUrl;


    await waitForMediaSourceOpen(
        streamer.mediaSource
    );


    if (
        generation !==
        streamer.generation
    ) {

        return;

    }


    streamer.videoSourceBuffer =
        streamer.mediaSource.addSourceBuffer(
            videoMime
        );


    streamer.audioSourceBuffer =
        streamer.mediaSource.addSourceBuffer(
            audioMime
        );


    const videoInit =
        await fetchCacheFile(
            video.videoId,
            manifest.videoInit.filename,
            streamer.abortController.signal
        );


    const audioInit =
        await fetchCacheFile(
            video.videoId,
            manifest.audioInit.filename,
            streamer.abortController.signal
        );


    await appendBuffer(
        streamer.videoSourceBuffer,
        videoInit
    );


    await appendBuffer(
        streamer.audioSourceBuffer,
        audioInit
    );


    streamer.initialized =
        true;


    const savedPosition =
        getSavedPosition(
            video.videoId
        );


    if (
        savedPosition > 0
    ) {

        streamer.pendingSeek =
            savedPosition;

    }


    await fillBuffer(
        generation,
        INITIAL_BUFFER_SECONDS
    );


    if (
        generation !==
        streamer.generation
    ) {

        return;

    }


    playerLoading.classList.add(
        "hidden"
    );


    try {

        await youtubePlayer.play();

    } catch (error) {

        console.log(
            "Autoplay was blocked."
        );

    }


    if (
        streamer.pendingSeek !== null
    ) {

        const target =
            streamer.pendingSeek;

        streamer.pendingSeek =
            null;


        if (
            target > 0 &&
            target <
                getDuration()
        ) {

            try {

                youtubePlayer.currentTime =
                    target;

            } catch (error) {

                console.warn(
                    "Could not restore position:",
                    error
                );

            }

        }

    }


    maintainBuffer(
        generation
    );

}


/* ============================================================
   MANIFEST
============================================================ */

const manifestMemoryCache =
    new Map();


async function fetchManifest(
    videoId,
    signal
) {

    if (
        manifestMemoryCache.has(
            videoId
        )
    ) {

        return manifestMemoryCache.get(
            videoId
        );

    }


    const data =
        await fetchCacheFile(
            videoId,
            "manifest.json",
            signal
        );


    const text =
        new TextDecoder()
            .decode(
                data
            );


    const manifest =
        JSON.parse(
            text
        );


    manifestMemoryCache.set(
        videoId,
        manifest
    );


    return manifest;

}


/* ============================================================
   CACHE FILE FETCHING
============================================================ */

async function fetchCacheFile(
    videoId,
    filename,
    signal
) {

    const url =
        CACHE_ENDPOINT +
        "?id=" +
        encodeURIComponent(
            videoId
        ) +
        "&file=" +
        encodeURIComponent(
            filename
        );


    let lastError =
        null;


    for (
        let attempt = 0;
        attempt <
            MAX_DOWNLOAD_RETRIES;
        attempt++
    ) {

        try {

            const response =
                await fetch(
                    url,
                    {
                        signal:
                            signal,

                        cache:
                            "force-cache"
                    }
                );


            if (
                !response.ok
            ) {

                throw new Error(
                    "HTTP " +
                    response.status +
                    " while loading " +
                    filename
                );

            }


            return await response.arrayBuffer();

        } catch (error) {

            lastError =
                error;


            if (
                error.name ===
                "AbortError"
            ) {

                throw error;

            }


            await delay(
                400 *
                (attempt + 1)
            );

        }

    }


    throw lastError ||
        new Error(
            "Failed to load " +
            filename
        );

}


/* ============================================================
   MSE APPEND
============================================================ */

function appendBuffer(
    sourceBuffer,
    data
) {

    return new Promise(
        function(
            resolve,
            reject
        ) {

            if (
                !sourceBuffer
            ) {

                reject(
                    new Error(
                        "SourceBuffer is unavailable."
                    )
                );

                return;

            }


            function done() {

                cleanup();

                resolve();

            }


            function failed() {

                cleanup();

                reject(
                    new Error(
                        "Media SourceBuffer error."
                    )
                );

            }


            function cleanup() {

                sourceBuffer.removeEventListener(
                    "updateend",
                    done
                );

                sourceBuffer.removeEventListener(
                    "error",
                    failed
                );

            }


            sourceBuffer.addEventListener(
                "updateend",
                done,
                {
                    once: true
                }
            );


            sourceBuffer.addEventListener(
                "error",
                failed,
                {
                    once: true
                }
            );


            try {

                sourceBuffer.appendBuffer(
                    data
                );

            } catch (error) {

                cleanup();

                reject(
                    error
                );

            }

        }
    );

}


/* ============================================================
   BUFFER CALCULATIONS
============================================================ */

function getBufferedAhead() {

    if (
        !youtubePlayer.buffered.length
    ) {

        return 0;

    }


    const currentTime =
        youtubePlayer.currentTime;


    for (
        let i = 0;
        i <
            youtubePlayer.buffered.length;
        i++
    ) {

        const start =
            youtubePlayer.buffered.start(
                i
            );

        const end =
            youtubePlayer.buffered.end(
                i
            );


        if (
            currentTime >= start &&
            currentTime <= end
        ) {

            return Math.max(
                0,
                end -
                    currentTime
            );

        }

    }


    return 0;

}


function getDuration() {

    if (
        streamer.manifest &&
        Number.isFinite(
            Number(
                streamer.manifest.duration
            )
        )
    ) {

        return Number(
            streamer.manifest.duration
        );

    }


    if (
        Number.isFinite(
            youtubePlayer.duration
        )
    ) {

        return youtubePlayer.duration;

    }


    return 0;

}


/* ============================================================
   BUFFER-AWARE DOWNLOADING
============================================================ */

async function fillBuffer(
    generation,
    requestedTarget
) {

    if (
        !streamer.initialized
    ) {

        return;

    }


    if (
        streamer.downloading
    ) {

        return;

    }


    streamer.downloading =
        true;


    try {

        while (
            generation ===
                streamer.generation
        ) {

            if (
                streamer.ended
            ) {

                break;

            }


            if (
                youtubePlayer.paused &&
                getBufferedAhead() >=
                    INITIAL_BUFFER_SECONDS
            ) {

                break;

            }


            const buffered =
                getBufferedAhead();


            const target =
                requestedTarget ||
                TARGET_BUFFER_SECONDS;


            if (
                buffered >=
                    Math.min(
                        target,
                        MAX_BUFFER_SECONDS
                    )
            ) {

                break;

            }


            const videoSegment =
                streamer.manifest
                    .videoSegments[
                        streamer.videoNextIndex
                    ];


            const audioSegment =
                streamer.manifest
                    .audioSegments[
                        streamer.audioNextIndex
                    ];


            if (
                !videoSegment &&
                !audioSegment
            ) {

                streamer.ended =
                    true;

                finishMediaSource();

                break;

            }


            if (
                videoSegment
            ) {

                if (
                    !streamer.downloadedVideo.has(
                        videoSegment.filename
                    )
                ) {

                    const data =
                        await fetchCacheFile(
                            streamer.videoId,
                            videoSegment.filename,
                            streamer.abortController.signal
                        );


                    if (
                        generation !==
                        streamer.generation
                    ) {

                        break;

                    }


                    await appendBuffer(
                        streamer.videoSourceBuffer,
                        data
                    );


                    streamer.downloadedVideo.add(
                        videoSegment.filename
                    );

                }


                streamer.videoNextIndex++;

            }


            if (
                audioSegment
            ) {

                if (
                    !streamer.downloadedAudio.has(
                        audioSegment.filename
                    )
                ) {

                    const data =
                        await fetchCacheFile(
                            streamer.videoId,
                            audioSegment.filename,
                            streamer.abortController.signal
                        );


                    if (
                        generation !==
                        streamer.generation
                    ) {

                        break;

                    }


                    await appendBuffer(
                        streamer.audioSourceBuffer,
                        data
                    );


                    streamer.downloadedAudio.add(
                        audioSegment.filename
                    );

                }


                streamer.audioNextIndex++;

            }


            if (
                getBufferedAhead() >=
                    MAX_BUFFER_SECONDS
            ) {

                break;

            }

        }

    } finally {

        streamer.downloading =
            false;

    }

}


/* ============================================================
   BUFFER MAINTENANCE
============================================================ */

async function maintainBuffer(
    generation
) {

    while (
        generation ===
        streamer.generation
    ) {

        if (
            !streamer.initialized ||
            streamer.ended
        ) {

            break;

        }


        await delay(
            900
        );


        if (
            generation !==
            streamer.generation
        ) {

            break;

        }


        const buffered =
            getBufferedAhead();


        if (
            youtubePlayer.paused &&
            buffered >=
                INITIAL_BUFFER_SECONDS
        ) {

            continue;

        }


        if (
            buffered <=
            LOW_BUFFER_SECONDS
        ) {

            await fillBuffer(
                generation,
                TARGET_BUFFER_SECONDS
            );

        }

    }

}


/* ============================================================
   PLAYBACK EVENTS
============================================================ */

youtubePlayer.addEventListener(
    "play",
    function() {

        if (
            streamer.initialized &&
            streamer.manifest
        ) {

            fillBuffer(
                streamer.generation,
                TARGET_BUFFER_SECONDS
            );

        }

    }
);


youtubePlayer.addEventListener(
    "pause",
    function() {

        saveCurrentPosition();

    }
);


youtubePlayer.addEventListener(
    "timeupdate",
    function() {

        const current =
            youtubePlayer.currentTime;


        if (
            Math.abs(
                current -
                streamer.lastSavedTime
            ) >=
            5
        ) {

            streamer.lastSavedTime =
                current;

            saveCurrentPosition();

        }

    }
);


youtubePlayer.addEventListener(
    "waiting",
    function() {

        if (
            streamer.initialized
        ) {

            playerLoading.classList.remove(
                "hidden"
            );

        }

    }
);


youtubePlayer.addEventListener(
    "playing",
    function() {

        playerLoading.classList.add(
            "hidden"
        );

    }
);


youtubePlayer.addEventListener(
    "ended",
    function() {

        saveCurrentPosition(
            true
        );


        streamer.ended =
            true;


        finishMediaSource();

    }
);


/* ============================================================
   SEEKING
============================================================ */

let seekTimer =
    null;


youtubePlayer.addEventListener(
    "seeking",
    function() {

        clearTimeout(
            seekTimer
        );


        seekTimer =
            setTimeout(
                function() {

                    handleSeek(
                        youtubePlayer.currentTime
                    );

                },
                80
            );

    }
);


async function handleSeek(
    time
) {

    if (
        !streamer.manifest ||
        !streamer.initialized
    ) {

        return;

    }


    if (
        isTimeBuffered(
            time
        )
    ) {

        fillBuffer(
            streamer.generation,
            TARGET_BUFFER_SECONDS
        );

        return;

    }


    /*
        For a seek outside the current buffer, restart the
        MSE pipeline at the requested segment.

        The existing cache means this does not create a new
        YouTube extraction or cache-generation operation.
    */

    const video =
        state.currentVideo;


    if (!video) {
        return;
    }


    const wasPlaying =
        !youtubePlayer.paused;


    const target =
        Math.max(
            0,
            time
        );


    try {

        await rebuildStreamAtTime(
            video,
            target
        );


        if (
            wasPlaying
        ) {

            try {

                await youtubePlayer.play();

            } catch (error) {

                console.log(
                    "Playback requires user interaction after seek."
                );

            }

        }

    } catch (error) {

        if (
            error.name !==
            "AbortError"
        ) {

            console.error(
                "Seek failed:",
                error
            );

            showPlayerError(
                "Seek failed: " +
                error.message
            );

        }

    }

}


/* ============================================================
   REBUILD STREAM AT SEEK POSITION
============================================================ */

async function rebuildStreamAtTime(
    video,
    time
) {

    stopStreaming();


    streamer.generation++;


    const generation =
        streamer.generation;


    streamer.videoId =
        video.videoId;


    streamer.abortController =
        new AbortController();


    streamer.downloadedVideo =
        new Set();


    streamer.downloadedAudio =
        new Set();


    streamer.manifest =
        await fetchManifest(
            video.videoId,
            streamer.abortController.signal
        );


    streamer.videoNextIndex =
        Math.max(
            0,
            Math.floor(
                time /
                getSegmentDuration()
            )
        );


    streamer.audioNextIndex =
        streamer.videoNextIndex;


    const videoMime =
        'video/mp4; codecs="' +
        streamer.manifest.videoCodec +
        '"';


    const audioMime =
        'audio/mp4; codecs="' +
        streamer.manifest.audioCodec +
        '"';


    streamer.mediaSource =
        new MediaSource();


    streamer.objectUrl =
        URL.createObjectURL(
            streamer.mediaSource
        );


    youtubePlayer.src =
        streamer.objectUrl;


    await waitForMediaSourceOpen(
        streamer.mediaSource
    );


    if (
        generation !==
        streamer.generation
    ) {

        return;

    }


    streamer.videoSourceBuffer =
        streamer.mediaSource.addSourceBuffer(
            videoMime
        );


    streamer.audioSourceBuffer =
        streamer.mediaSource.addSourceBuffer(
            audioMime
        );


    const videoInit =
        await fetchCacheFile(
            video.videoId,
            streamer.manifest.videoInit.filename,
            streamer.abortController.signal
        );


    const audioInit =
        await fetchCacheFile(
            video.videoId,
            streamer.manifest.audioInit.filename,
            streamer.abortController.signal
        );


    await appendBuffer(
        streamer.videoSourceBuffer,
        videoInit
    );


    await appendBuffer(
        streamer.audioSourceBuffer,
        audioInit
    );


    streamer.initialized =
        true;


    while (
        streamer.videoNextIndex <
            streamer.manifest.videoSegments.length
    ) {

        if (
            generation !==
            streamer.generation
        ) {

            return;

        }


        const videoSegment =
            streamer.manifest
                .videoSegments[
                    streamer.videoNextIndex
                ];


        const audioSegment =
            streamer.manifest
                .audioSegments[
                    streamer.audioNextIndex
                ];


        const videoData =
            await fetchCacheFile(
                video.videoId,
                videoSegment.filename,
                streamer.abortController.signal
            );


        await appendBuffer(
            streamer.videoSourceBuffer,
            videoData
        );


        streamer.downloadedVideo.add(
            videoSegment.filename
        );


        if (
            audioSegment
        ) {

            const audioData =
                await fetchCacheFile(
                    video.videoId,
                    audioSegment.filename,
                    streamer.abortController.signal
                );


            await appendBuffer(
                streamer.audioSourceBuffer,
                audioData
            );


            streamer.downloadedAudio.add(
                audioSegment.filename
            );

        }


        streamer.videoNextIndex++;
        streamer.audioNextIndex++;


        const estimatedEnd =
            streamer.videoNextIndex *
            getSegmentDuration();


        if (
            estimatedEnd >=
                time +
                TARGET_BUFFER_SECONDS
        ) {

            break;

        }

    }


    playerLoading.classList.add(
        "hidden"
    );


    /*
        DASH/fMP4 timestamps are retained by MSE, so use
        the actual requested timestamp.
    */

    try {

        youtubePlayer.currentTime =
            time;

    } catch (error) {

        console.warn(
            "Could not seek to requested time:",
            error
        );

    }


    maintainBuffer(
        streamer.generation
    );

}


/* ============================================================
   SEGMENT DURATION
============================================================ */

function getSegmentDuration() {

    if (
        streamer.manifest &&
        Number.isFinite(
            Number(
                streamer.manifest.segmentDuration
            )
        )
    ) {

        return Number(
            streamer.manifest.segmentDuration
        );

    }


    return 4;

}


/* ============================================================
   BUFFER CHECK
============================================================ */

function isTimeBuffered(
    time
) {

    if (
        !youtubePlayer.buffered.length
    ) {

        return false;

    }


    for (
        let i = 0;
        i <
            youtubePlayer.buffered.length;
        i++
    ) {

        if (
            time >=
                youtubePlayer.buffered.start(
                    i
                ) &&
            time <=
                youtubePlayer.buffered.end(
                    i
                )
        ) {

            return true;

        }

    }


    return false;

}


/* ============================================================
   MEDIA SOURCE HELPERS
============================================================ */

function waitForMediaSourceOpen(
    mediaSource
) {

    if (
        mediaSource.readyState ===
        "open"
    ) {

        return Promise.resolve();

    }


    return new Promise(
        function(
            resolve,
            reject
        ) {

            mediaSource.addEventListener(
                "sourceopen",
                function() {

                    resolve();

                },
                {
                    once: true
                }
            );


            mediaSource.addEventListener(
                "error",
                function() {

                    reject(
                        new Error(
                            "MediaSource failed to open."
                        )
                    );

                },
                {
                    once: true
                }
            );

        }
    );

}


function finishMediaSource() {

    if (
        streamer.mediaSource &&
        streamer.mediaSource.readyState ===
            "open"
    ) {

        try {

            streamer.mediaSource.endOfStream();

        } catch (error) {

            console.warn(
                "endOfStream failed:",
                error
            );

        }

    }

}


/* ============================================================
   STOP STREAMING
============================================================ */

function stopStreaming() {

    streamer.generation++;


    if (
        streamer.abortController
    ) {

        try {

            streamer.abortController.abort();

        } catch (error) {

            console.warn(
                error
            );

        }

    }


    streamer.abortController =
        null;


    streamer.downloading =
        false;


    streamer.initialized =
        false;


    streamer.ended =
        false;


    streamer.pendingSeek =
        null;


    if (
        streamer.objectUrl
    ) {

        try {

            URL.revokeObjectURL(
                streamer.objectUrl
            );

        } catch (error) {

            console.warn(
                error
            );

        }

    }


    streamer.objectUrl =
        null;


    streamer.mediaSource =
        null;


    streamer.videoSourceBuffer =
        null;


    streamer.audioSourceBuffer =
        null;


    streamer.manifest =
        null;


    streamer.videoId =
        null;


    streamer.videoNextIndex =
        0;


    streamer.audioNextIndex =
        0;


    streamer.downloadedVideo =
        new Set();


    streamer.downloadedAudio =
        new Set();


    try {

        youtubePlayer.pause();

    } catch (error) {

        console.warn(
            error
        );

    }


    try {

        youtubePlayer.removeAttribute(
            "src"
        );

        youtubePlayer.load();

    } catch (error) {

        console.warn(
            error
        );

    }

}


/* ============================================================
   PLAYER ERROR
============================================================ */

function showPlayerError(
    message
) {

    playerLoading.classList.add(
        "hidden"
    );


    playerErrorText.textContent =
        message;


    playerError.classList.remove(
        "hidden"
    );

}


retryButton.addEventListener(
    "click",
    function() {

        if (
            state.currentVideo
        ) {

            openVideo(
                state.currentVideo
            );

        }

    }
);


/* ============================================================
   HISTORY
============================================================ */

function saveToHistory(
    video
) {

    const existing =
        state.history.filter(
            function(item) {

                return (
                    item.videoId !==
                    video.videoId
                );

            }
        );


    const entry = {
        videoId:
            video.videoId,

        title:
            video.title ||
            "Untitled video",

        channel:
            video.channel ||
            "Unknown channel",

        description:
            video.description ||
            "",

        thumbnail:
            thumbnailUrl(
                video
            ),

        watchedAt:
            Date.now(),

        position:
            getSavedPosition(
                video.videoId
            )

    };


    state.history =
        [
            entry,
            ...existing
        ].slice(
            0,
            100
        );


    saveStorage(
        "codetube-history",
        state.history
    );

}


function renderHistory() {

    if (
        !state.history.length
    ) {

        historyGrid.innerHTML =
            createEmptyMessage(
                "Your watch history is empty."
            );

        return;

    }


    renderVideoGrid(
        historyGrid,
        state.history
    );

}


clearHistoryButton.addEventListener(
    "click",
    function() {

        state.history =
            [];


        saveStorage(
            "codetube-history",
            state.history
        );


        renderHistory();


        showToast(
            "Watch history cleared."
        );

    }
);


/* ============================================================
   PLAYBACK POSITION
============================================================ */

function getPositionKey(
    videoId
) {

    return (
        "codetube-position-" +
        videoId
    );

}


function getSavedPosition(
    videoId
) {

    try {

        return Number(
            localStorage.getItem(
                getPositionKey(
                    videoId
                )
            )
        ) || 0;

    } catch (error) {

        return 0;

    }

}


function saveCurrentPosition(
    completed = false
) {

    if (
        !state.currentVideo
    ) {

        return;

    }


    const videoId =
        state.currentVideo.videoId;


    if (
        completed
    ) {

        try {

            localStorage.removeItem(
                getPositionKey(
                    videoId
                )
            );

        } catch (error) {

            console.warn(
                error
            );

        }


        return;

    }


    try {

        localStorage.setItem(
            getPositionKey(
                videoId
            ),
            String(
                youtubePlayer.currentTime
            )
        );

    } catch (error) {

        console.warn(
            error
        );

    }

}


/* ============================================================
   WATCH LATER
============================================================ */

watchLaterButton.addEventListener(
    "click",
    function() {

        if (
            !state.currentVideo
        ) {

            return;

        }


        const id =
            state.currentVideo.videoId;


        const exists =
            state.watchLater.some(
                function(item) {

                    return (
                        item.videoId ===
                        id
                    );

                }
            );


        if (
            exists
        ) {

            state.watchLater =
                state.watchLater.filter(
                    function(item) {

                        return (
                            item.videoId !==
                            id
                        );

                    }
                );


            showToast(
                "Removed from Watch later."
            );

        } else {

            state.watchLater.unshift(
                {
                    ...state.currentVideo,
                    thumbnail:
                        thumbnailUrl(
                            state.currentVideo
                        )
                }
            );


            showToast(
                "Saved to Watch later."
            );

        }


        saveStorage(
            "codetube-watch-later",
            state.watchLater
        );


        updateWatchLaterButton();

    }
);


function updateWatchLaterButton() {

    if (
        !state.currentVideo
    ) {

        return;

    }


    const exists =
        state.watchLater.some(
            function(item) {

                return (
                    item.videoId ===
                    state.currentVideo.videoId
                );

            }
        );


    watchLaterButton.classList.toggle(
        "active",
        exists
    );


    watchLaterButton.innerHTML =
        exists
            ? "✓ Saved"
            : "⏱ Save";

}


function renderWatchLater() {

    if (
        !state.watchLater.length
    ) {

        watchLaterGrid.innerHTML =
            createEmptyMessage(
                "Your Watch later list is empty."
            );

        return;

    }


    renderVideoGrid(
        watchLaterGrid,
        state.watchLater
    );

}


/* ============================================================
   LIKE / DISLIKE
============================================================ */

likeButton.addEventListener(
    "click",
    function() {

        if (
            !state.currentVideo
        ) {

            return;

        }


        const id =
            state.currentVideo.videoId;


        state.likes[id] =
            state.likes[id] ===
            "like"
                ? null
                : "like";


        saveStorage(
            "codetube-likes",
            state.likes
        );


        updateLikeButton();

    }
);


dislikeButton.addEventListener(
    "click",
    function() {

        if (
            !state.currentVideo
        ) {

            return;

        }


        const id =
            state.currentVideo.videoId;


        state.likes[id] =
            state.likes[id] ===
            "dislike"
                ? null
                : "dislike";


        saveStorage(
            "codetube-likes",
            state.likes
        );


        updateLikeButton();

    }
);


function updateLikeButton() {

    if (
        !state.currentVideo
    ) {

        return;

    }


    const value =
        state.likes[
            state.currentVideo.videoId
        ];


    likeButton.classList.toggle(
        "active",
        value === "like"
    );


    dislikeButton.classList.toggle(
        "active",
        value === "dislike"
    );

}


/* ============================================================
   SUBSCRIBE
============================================================ */

subscribeButton.addEventListener(
    "click",
    function() {

        if (
            !state.currentVideo
        ) {

            return;

        }


        const channel =
            state.currentVideo.channel ||
            "unknown";


        state.subscriptions[
            channel
        ] =
            !state.subscriptions[
                channel
            ];


        saveStorage(
            "codetube-subscriptions",
            state.subscriptions
        );


        updateSubscribeButton();

    }
);


function updateSubscribeButton() {

    if (
        !state.currentVideo
    ) {

        return;

    }


    const channel =
        state.currentVideo.channel ||
        "unknown";


    const subscribed =
        Boolean(
            state.subscriptions[
                channel
            ]
        );


    subscribeButton.textContent =
        subscribed
            ? "Subscribed"
            : "Subscribe";


    subscribeButton.classList.toggle(
        "subscribed",
        subscribed
    );

}


/* ============================================================
   SHARE
============================================================ */

shareButton.addEventListener(
    "click",
    async function() {

        if (
            !state.currentVideo
        ) {

            return;

        }


        const url =
            window.location.origin +
            window.location.pathname +
            "?v=" +
            encodeURIComponent(
                state.currentVideo.videoId
            );


        try {

            if (
                navigator.share
            ) {

                await navigator.share(
                    {
                        title:
                            state.currentVideo.title,

                        url:
                            url
                    }
                );

            } else if (
                navigator.clipboard
            ) {

                await navigator.clipboard.writeText(
                    url
                );


                showToast(
                    "Video link copied."
                );

            } else {

                showToast(
                    url
                );

            }

        } catch (error) {

            if (
                error.name !==
                "AbortError"
            ) {

                console.warn(
                    error
                );

            }

        }

    }
);


/* ============================================================
   RELATED VIDEOS
============================================================ */

async function renderRelated(
    currentVideo
) {

    relatedVideos.innerHTML =
        createRelatedSkeletons(
            5
        );


    try {

        const query =
            currentVideo.channel ||
            currentVideo.title ||
            "popular";


        const response =
            await fetch(
                SEARCH_ENDPOINT +
                "?q=" +
                encodeURIComponent(
                    query
                ),
                {
                    cache:
                        "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "HTTP " +
                response.status
            );

        }


        const data =
            await response.json();


        const videos =
            (
                Array.isArray(
                    data.videos
                )
                    ? data.videos
                    : []
            ).filter(
                function(video) {

                    return (
                        video.videoId !==
                        currentVideo.videoId
                    );

                }
            ).slice(
                0,
                8
            );


        relatedVideos.innerHTML =
            "";


        videos.forEach(
            function(video) {

                relatedVideos.appendChild(
                    createRelatedCard(
                        video
                    )
                );

            }
        );


    } catch (error) {

        relatedVideos.innerHTML =
            createEmptyMessage(
                "Related videos unavailable."
            );

    }

}


function createRelatedCard(
    video
) {

    const item =
        document.createElement(
            "article"
        );


    item.className =
        "related-card";


    const image =
        thumbnailUrl(
            video
        );


    item.innerHTML =

        '<div class="related-thumbnail">' +

            (
                image
                    ? (
                        '<img src="' +
                        escapeAttribute(
                            image
                        ) +
                        '" alt="" loading="lazy">'
                    )
                    : ""
            ) +

        '</div>' +

        '<div>' +

            '<h3 class="related-title">' +
                escapeHtml(
                    video.title ||
                    "Untitled video"
                ) +
            '</h3>' +

            '<div class="related-channel">' +
                escapeHtml(
                    video.channel ||
                    "Unknown channel"
                ) +
            '</div>' +

        '</div>';


    item.addEventListener(
        "click",
        function() {

            openVideo(
                video
            );

        }
    );


    return item;

}


/* ============================================================
   URL VIDEO LOADING
============================================================ */

function loadVideoFromUrl() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const videoId =
        params.get(
            "v"
        );


    if (
        !videoId
    ) {

        return false;

    }


    openVideo(
        {
            videoId:
                videoId,

            title:
                "Loading video..."
        }
    );


    return true;

}


/* ============================================================
   HELPERS
============================================================ */

function createSkeletons(
    count
) {

    let html =
        "";


    for (
        let i = 0;
        i < count;
        i++
    ) {

        html +=

            '<div class="skeleton-card">' +

                '<div class="skeleton-thumbnail"></div>' +

                '<div class="skeleton-line"></div>' +

                '<div class="skeleton-line short"></div>' +

            '</div>';

    }


    return html;

}


function createSearchSkeletons() {

    let html =
        "";


    for (
        let i = 0;
        i < 7;
        i++
    ) {

        html +=

            '<div class="search-result">' +

                '<div class="skeleton-thumbnail"></div>' +

                '<div>' +

                    '<div class="skeleton-line"></div>' +

                    '<div class="skeleton-line short"></div>' +

                    '<div class="skeleton-line"></div>' +

                '</div>' +

            '</div>';

    }


    return html;

}


function createRelatedSkeletons(
    count
) {

    let html =
        "";


    for (
        let i = 0;
        i < count;
        i++
    ) {

        html +=

            '<div class="related-card">' +

                '<div class="skeleton-thumbnail"></div>' +

                '<div>' +

                    '<div class="skeleton-line"></div>' +

                    '<div class="skeleton-line short"></div>' +

                '</div>' +

            '</div>';

    }


    return html;

}


function createEmptyMessage(
    message
) {

    return (
        '<div class="empty-page">' +
            '<div class="empty-icon">▶</div>' +
            '<h1>Nothing here yet</h1>' +
            '<p>' +
                escapeHtml(
                    message
                ) +
            '</p>' +
        '</div>'
    );

}


function createErrorMessage(
    title,
    message
) {

    return (
        '<div class="empty-page">' +
            '<div class="empty-icon">⚠</div>' +
            '<h1>' +
                escapeHtml(
                    title
                ) +
            '</h1>' +
            '<p>' +
                escapeHtml(
                    message ||
                    "Something went wrong."
                ) +
            '</p>' +
        '</div>'
    );

}


function escapeHtml(
    value
) {

    return String(
        value
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


function escapeAttribute(
    value
) {

    return escapeHtml(
        value
    );

}


function getInitial(
    text
) {

    const clean =
        String(
            text
        ).trim();


    if (!clean) {
        return "C";
    }


    return clean
        .charAt(0)
        .toUpperCase();

}


function capitalize(
    value
) {

    return String(
        value
    )
        .charAt(0)
        .toUpperCase() +
        String(
            value
        ).slice(1);

}


function delay(
    milliseconds
) {

    return new Promise(
        function(resolve) {

            setTimeout(
                resolve,
                milliseconds
            );

        }
    );

}


/* ============================================================
   INITIALIZATION
============================================================ */

window.addEventListener(
    "beforeunload",
    function() {

        saveCurrentPosition();

        stopStreaming();

    }
);


document.addEventListener(
    "visibilitychange",
    function() {

        if (
            document.visibilityState ===
            "hidden"
        ) {

            saveCurrentPosition();

        }

    }
);


if (
    !loadVideoFromUrl()
) {

    loadHome();

}


/* ============================================================
   PLAYER KEYBOARD CONTROLS
============================================================ */

document.addEventListener(
    "keydown",
    function(event) {

        const tag =
            document.activeElement &&
            document.activeElement.tagName;


        if (
            tag === "INPUT" ||
            tag === "TEXTAREA"
        ) {

            return;

        }


        if (
            state.currentPage !==
            "watch"
        ) {

            return;

        }


        switch (
            event.key.toLowerCase()
        ) {

            case " ":

                event.preventDefault();

                if (
                    youtubePlayer.paused
                ) {

                    youtubePlayer.play();

                } else {

                    youtubePlayer.pause();

                }

                break;


            case "k":

                event.preventDefault();

                if (
                    youtubePlayer.paused
                ) {

                    youtubePlayer.play();

                } else {

                    youtubePlayer.pause();

                }

                break;


            case "arrowleft":

                event.preventDefault();

                youtubePlayer.currentTime =
                    Math.max(
                        0,
                        youtubePlayer.currentTime -
                            5
                    );

                break;


            case "arrowright":

                event.preventDefault();

                youtubePlayer.currentTime =
                    Math.min(
                        getDuration(),
                        youtubePlayer.currentTime +
                            5
                    );

                break;


            case "arrowup":

                event.preventDefault();

                youtubePlayer.volume =
                    Math.min(
                        1,
                        youtubePlayer.volume +
                            0.05
                    );

                break;


            case "arrowdown":

                event.preventDefault();

                youtubePlayer.volume =
                    Math.max(
                        0,
                        youtubePlayer.volume -
                            0.05
                    );

                break;


            case "m":

                event.preventDefault();

                youtubePlayer.muted =
                    !youtubePlayer.muted;

                break;


            case "f":

                event.preventDefault();

                toggleFullscreen();

                break;

        }

    }
);


/* ============================================================
   FULLSCREEN
============================================================ */

playerShell.addEventListener(
    "dblclick",
    function() {

        toggleFullscreen();

    }
);


function toggleFullscreen() {

    if (
        document.fullscreenElement
    ) {

        document.exitFullscreen();

        return;

    }


    if (
        playerShell.requestFullscreen
    ) {

        playerShell.requestFullscreen();

    }

}
