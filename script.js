
// ─────────────────────────────────────────────
// MOBILE VIEWPORT FIX
// ─────────────────────────────────────────────

function setVh() {

    const vh = window.innerHeight * 0.01;

    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

setVh();

window.addEventListener('resize', setVh);

window.addEventListener(
    'orientationchange',
    () => setTimeout(setVh, 200)
);

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const API = "https://friday99nn.pythonanywhere.com/infinity";

const POLL_INTERVAL = 3000;

let login = false;

let username = "";

let otherName = "";

let lastMsgCount = 0;

let selectedFile = null;

let selectedThumb = null;

let selectedVideo = null;

let sending = false;

// AUDIO

let mediaRecorder = null;

let audioChunks = [];

let recordedAudio = null;

let isRecording = false;

// HELPERS

const $ = id => document.getElementById(id);

const showLoading = () =>
    $("loadingOverlay").classList.add("show");

const hideLoading = () =>
    $("loadingOverlay").classList.remove("show");

function scrollToBottom(instant = false) {

    const area = $("chatArea");

    area.scrollTo({
        top: area.scrollHeight,
        behavior: instant ? "instant" : "smooth"
    });
}

function isAtBottom() {

    const area = $("chatArea");

    return area.scrollHeight - area.scrollTop - area.clientHeight < 100;
}

function formatTime() {

    return new Date().toLocaleString(
        "en-GB",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        }
    ).toUpperCase().replace(",", "");
}

function imageUrl(path) {

    if (!path) return "";

    if (
        path.startsWith("http")
        || path.startsWith("data:")
    ) {
        return path;
    }

    return "https://friday99nn.pythonanywhere.com" + path;
}

// ─────────────────────────────────────────────
// RENDER MESSAGE
// ─────────────────────────────────────────────

function renderMessage(data) {

    const isMe = (data.username === username);

    const wrapper = document.createElement("div");

    wrapper.className =
        `msg-wrapper ${isMe ? "me" : "other"}`;

    wrapper.dataset.id = String(data.id || "");

    const bubble = document.createElement("div");

    bubble.className = "bubble";

    // IMAGE

    if (data.image) {

        const src = imageUrl(data.image);

        const imgWrap = document.createElement("div");

        imgWrap.className = "chat-img-wrap";

        const skeleton = document.createElement("div");

        skeleton.className = "img-skeleton";

        imgWrap.appendChild(skeleton);

        const img = document.createElement("img");

        img.className = "chat-img";

        img.style.display = "none";

        img.src = src;

        img.onload = () => {

            skeleton.remove();

            img.style.display = "block";
        };

        img.onclick = () => openLightbox(src);

        imgWrap.appendChild(img);

        bubble.appendChild(imgWrap);
    }

    // AUDIO

    if (data.audio) {

        const audio = document.createElement("audio");

        audio.controls = true;

        audio.src = imageUrl(data.audio);

        audio.style.width = "100%";

        bubble.appendChild(audio);
    }

    // VIDEO

    if (data.video) {

        const video = document.createElement("video");

        video.controls = true;

        video.src = imageUrl(data.video);

        video.style.width = "100%";

        video.style.borderRadius = "14px";

        bubble.appendChild(video);
    }

    // TEXT

    if (
        data.message
        && data.message.trim()
    ) {

        const p = document.createElement("div");

        p.className = "msg-text";

        p.textContent = data.message;

        bubble.appendChild(p);
    }

    // TIME

    const timeEl = document.createElement("div");

    timeEl.className = "msg-time";

    timeEl.textContent = data.time;

    bubble.appendChild(timeEl);

    wrapper.appendChild(bubble);

    return wrapper;
}

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────

function start() {

    const keyEl = $("key");

    const errEl = $("keyError");

    const key = keyEl.value.trim();

    if (!key) {

        keyEl.classList.add("error");

        return;
    }

    showLoading();

    const fd = new FormData();

    fd.append("key", key);

    fetch(
        `${API}/start`,
        {
            method: "POST",
            body: fd
        }
    )
    .then(r => r.json())
    .then(data => {

        hideLoading();

        if (data.status === "invalid") {

            keyEl.classList.add("error");

            errEl.style.display = "block";

            return;
        }

        username = data.username;

        otherName = data.other;

        login = true;

        $("otherName").textContent = otherName;

        $("otherInitial").textContent =
            otherName.charAt(0).toUpperCase();

        $("startup").style.display = "none";

        $("app").style.display = "flex";

        loadChat(true);
    })
    .catch(() => hideLoading());
}

// ─────────────────────────────────────────────
// SEND MESSAGE
// ─────────────────────────────────────────────

async function sendMessage() {

    if (sending) return;

    const msgEl = $("message");

    const message = msgEl.value.trim();

    if (
        !message
        && !selectedFile
        && !recordedAudio
        && !selectedVideo
    ) {
        return;
    }

    sending = true;

    setSendBtnState(true);

    const time = formatTime();

    const tempId = "tmp_" + Date.now();

    const el = renderMessage({
        id: tempId,
        username,
        message,
        image: selectedThumb,
        time
    });

    $("messages").appendChild(el);

    scrollToBottom();

    const fd = new FormData();

    fd.append("username", username);

    fd.append("message", message);

    fd.append("time", time);

    // IMAGE

    if (selectedFile) {

        try {

            const compressed =
                await compressToBlob(
                    selectedFile,
                    900,
                    0.75
                );

            fd.append(
                "image_file",
                compressed,
                "photo.jpg"
            );

        } catch (e) {

            fd.append(
                "image_file",
                selectedFile
            );
        }
    }

    // AUDIO

    if (recordedAudio) {

        fd.append(
            "audio_file",
            recordedAudio,
            "voice.webm"
        );
    }

    // VIDEO

    if (selectedVideo) {

        fd.append(
            "video_file",
            selectedVideo
        );
    }

    msgEl.value = "";

    clearImagePreview();

    fetch(
        `${API}/save_message`,
        {
            method: "POST",
            body: fd
        }
    )
    .then(r => r.json())
    .then(data => {

        el.dataset.id = String(data.id);

        if (data.image_url) {

            const img =
                el.querySelector(".chat-img");

            if (img) {

                img.src = imageUrl(data.image_url);
            }
        }
    })
    .finally(() => {

        sending = false;

        setSendBtnState(false);

        recordedAudio = null;

        selectedVideo = null;
    });
}

// ─────────────────────────────────────────────
// LOAD CHAT
// ─────────────────────────────────────────────

function loadChat(instant = false) {

    if (!login) return;

    const fd = new FormData();

    fd.append("username", username);

    fetch(
        `${API}/load_chat`,
        {
            method: "POST",
            body: fd
        }
    )
    .then(r => r.json())
    .then(messages => {

        if (messages.length === lastMsgCount) return;

        const container = $("messages");

        const atBottom = isAtBottom();

        const existingIds = new Set(
            [...container.querySelectorAll(".msg-wrapper")]
            .map(el => el.dataset.id)
        );

        messages.forEach(msg => {

            if (
                !existingIds.has(String(msg.id))
            ) {
                container.appendChild(
                    renderMessage(msg)
                );
            }
        });

        lastMsgCount = messages.length;

        if (atBottom) {

            scrollToBottom(instant);
        }
    });
}

setInterval(loadChat, POLL_INTERVAL);

// ─────────────────────────────────────────────
// IMAGE SELECT
// ─────────────────────────────────────────────

function handleImageSelect(event) {

    const file = event.target.files[0];

    if (!file) return;

    selectedFile = file;

    selectedThumb =
        URL.createObjectURL(file);

    $("previewImg").src =
        selectedThumb;

    $("imagePreview").classList.add("show");
}

// ─────────────────────────────────────────────
// VIDEO SELECT
// ─────────────────────────────────────────────

function handleVideoSelect(event) {

    const file = event.target.files[0];

    if (!file) return;

    selectedVideo = file;
}

// ─────────────────────────────────────────────
// VOICE RECORDING
// ─────────────────────────────────────────────

async function toggleRecording() {

    if (!isRecording) {

        const stream =
            await navigator.mediaDevices
            .getUserMedia({
                audio: true
            });

        mediaRecorder =
            new MediaRecorder(stream);

        audioChunks = [];

        mediaRecorder.ondataavailable = e => {
            audioChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {

            recordedAudio = new Blob(
                audioChunks,
                {
                    type: "audio/webm"
                }
            );
        };

        mediaRecorder.start();

        isRecording = true;

        $("recordBtn").innerText = "⏹";

    } else {

        mediaRecorder.stop();

        isRecording = false;

        $("recordBtn").innerText = "🎤";
    }
}

// ─────────────────────────────────────────────
// CLEAR PREVIEW
// ─────────────────────────────────────────────

function clearImagePreview() {

    if (selectedThumb) {

        URL.revokeObjectURL(selectedThumb);
    }

    selectedFile = null;

    selectedThumb = null;

    $("imagePreview").classList.remove("show");
}

// ─────────────────────────────────────────────
// BUTTON STATE
// ─────────────────────────────────────────────

function setSendBtnState(disabled) {

    $("sendBtn").disabled = disabled;

    $("sendBtn").style.opacity =
        disabled ? "0.5" : "1";
}

// ─────────────────────────────────────────────
// IMAGE COMPRESSION
// ─────────────────────────────────────────────

function compressToBlob(
    file,
    maxDim,
    quality
) {

    return new Promise((resolve, reject) => {

        const reader = new FileReader();

        reader.onload = e => {

            const img = new Image();

            img.onload = () => {

                let { width, height } = img;

                if (
                    width > maxDim
                    || height > maxDim
                ) {

                    if (width >= height) {

                        height = Math.round(
                            height * maxDim / width
                        );

                        width = maxDim;

                    } else {

                        width = Math.round(
                            width * maxDim / height
                        );

                        height = maxDim;
                    }
                }

                const canvas =
                    document.createElement("canvas");

                canvas.width = width;

                canvas.height = height;

                canvas
                .getContext("2d")
                .drawImage(
                    img,
                    0,
                    0,
                    width,
                    height
                );

                canvas.toBlob(
                    b => b
                        ? resolve(b)
                        : reject(),
                    "image/jpeg",
                    quality
                );
            };

            img.src = e.target.result;
        };

        reader.readAsDataURL(file);
    });
}

// ─────────────────────────────────────────────
// LIGHTBOX
// ─────────────────────────────────────────────

function openLightbox(src) {

    $("lightboxImg").src = src;

    $("lightbox").classList.add("open");
}

function closeLightbox() {

    $("lightbox").classList.remove("open");
}

// ─────────────────────────────────────────────
// DOM READY
// ─────────────────────────────────────────────

document.addEventListener(
    "DOMContentLoaded",
    () => {

        $("key").addEventListener(
            "keydown",
            e => {
                if (e.key === "Enter") start();
            }
        );

        $("message").addEventListener(
            "keydown",
            e => {
                if (e.key === "Enter") sendMessage();
            }
        );
    }
);

