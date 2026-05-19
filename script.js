
const API = "https://friday99nn.pythonanywhere.com/infinity";

const socket = io("https://friday99nn.pythonanywhere.com");

let username = "";
let otherName = "";

let mediaRecorder;
let audioChunks = [];

let peerConnection;
let localStream;

// =========================
// HELPERS
// =========================

function formatTime() {
    return new Date().toLocaleString();
}

function fileUrl(path) {
    return "https://friday99nn.pythonanywhere.com" + path;
}

function scrollBottom() {
    const area = document.getElementById("chatArea");
    area.scrollTop = area.scrollHeight;
}

// =========================
// LOGIN
// =========================

function start() {

    const key =
    document.getElementById("key").value.trim();

    if (!key) {
        alert("Enter key");
        return;
    }

    const fd = new FormData();

    fd.append("key", key);

    fetch(`${API}/start`, {
        method: "POST",
        body: fd
    })

    .then(res => res.json())

    .then(data => {

        if (data.status === "invalid") {

            alert("Invalid key");

            return;
        }

        username = data.username;
        otherName = data.other;

        document.getElementById("otherName").innerText =
        otherName;

        document.getElementById("startup").style.display =
        "none";

        document.getElementById("app").style.display =
        "flex";

        loadChat();

        setInterval(loadChat, 2000);
    })

    .catch(err => {
        console.log(err);
        alert("Server error");
    });
}

// =========================
// RENDER MESSAGE
// =========================

function renderMessage(data) {

    const wrap = document.createElement("div");

    wrap.className =
    data.username === username
    ? "msg-wrapper me"
    : "msg-wrapper other";

    const bubble = document.createElement("div");

    bubble.className = "bubble";

    // IMAGE
    if (data.image) {

        const img =
        document.createElement("img");

        img.src = fileUrl(data.image);

        img.className = "chat-img";

        bubble.appendChild(img);
    }

    // AUDIO
    if (data.audio) {

        const audio =
        document.createElement("audio");

        audio.controls = true;

        audio.src = fileUrl(data.audio);

        bubble.appendChild(audio);
    }

    // VIDEO
    if (data.video) {

        const video =
        document.createElement("video");

        video.controls = true;

        video.src = fileUrl(data.video);

        video.style.width = "100%";

        bubble.appendChild(video);
    }

    // TEXT
    if (data.message) {

        const text =
        document.createElement("div");

        text.className = "msg-text";

        text.innerText = data.message;

        bubble.appendChild(text);
    }

    // TIME
    const time =
    document.createElement("div");

    time.className = "msg-time";

    time.innerText = data.time;

    bubble.appendChild(time);

    wrap.appendChild(bubble);

    return wrap;
}

// =========================
// LOAD CHAT
// =========================

function loadChat() {

    fetch(`${API}/load_chat`, {
        method: "POST"
    })

    .then(res => res.json())

    .then(messages => {

        const container =
        document.getElementById("messages");

        container.innerHTML = "";

        messages.forEach(msg => {

            container.appendChild(
                renderMessage(msg)
            );
        });

        scrollBottom();
    });
}

// =========================
// SEND MESSAGE
// =========================

async function sendMessage() {

    const message =
    document.getElementById("message").value;

    const image =
    document.getElementById("imageInput").files[0];

    const video =
    document.getElementById("videoInput").files[0];

    const fd = new FormData();

    fd.append("username", username);

    fd.append("message", message);

    fd.append("time", formatTime());

    if (image) {
        fd.append("image_file", image);
    }

    if (video) {
        fd.append("video_file", video);
    }

    await fetch(`${API}/save_message`, {
        method: "POST",
        body: fd
    });

    document.getElementById("message").value = "";

    document.getElementById("imageInput").value = "";

    document.getElementById("videoInput").value = "";

    loadChat();
}

// =========================
// VOICE RECORDING
// =========================

async function recordVoice() {

    const stream =
    await navigator.mediaDevices.getUserMedia({
        audio: true
    });

    mediaRecorder =
    new MediaRecorder(stream);

    audioChunks = [];

    mediaRecorder.ondataavailable = e => {
        audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {

        const blob = new Blob(audioChunks, {
            type: "audio/webm"
        });

        const fd = new FormData();

        fd.append("username", username);

        fd.append("message", "");

        fd.append("time", formatTime());

        fd.append(
            "audio_file",
            blob,
            "voice.webm"
        );

        await fetch(`${API}/save_message`, {
            method: "POST",
            body: fd
        });

        loadChat();
    };

    mediaRecorder.start();

    alert("Recording 5 seconds...");

    setTimeout(() => {

        mediaRecorder.stop();

    }, 5000);
}

// =========================
// CALLING
// =========================

async function startCall() {

    try {

        localStream =
        await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        });

        peerConnection =
        new RTCPeerConnection();

        localStream.getTracks().forEach(track => {

            peerConnection.addTrack(
                track,
                localStream
            );
        });

        peerConnection.onicecandidate = event => {

            if (event.candidate) {

                socket.emit(
                    "ice-candidate",
                    {
                        candidate: event.candidate
                    }
                );
            }
        };

        const offer =
        await peerConnection.createOffer();

        await peerConnection.setLocalDescription(
            offer
        );

        socket.emit("call-user", {
            offer: offer
        });

        alert("Calling...");

    } catch(err) {

        console.log(err);

        alert("Call failed");
    }
}

socket.on("incoming-call", async data => {

    const accept =
    confirm("Incoming call");

    if (!accept) return;

    localStream =
    await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
    });

    peerConnection =
    new RTCPeerConnection();

    localStream.getTracks().forEach(track => {

        peerConnection.addTrack(
            track,
            localStream
        );
    });

    await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.offer)
    );

    const answer =
    await peerConnection.createAnswer();

    await peerConnection.setLocalDescription(
        answer
    );

    socket.emit("answer-call", {
        answer: answer
    });
});

socket.on("call-answered", async data => {

    await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data.answer)
    );
});

socket.on("ice-candidate", async data => {

    if (peerConnection) {

        await peerConnection.addIceCandidate(
            new RTCIceCandidate(data.candidate)
        );
    }
});

// =========================
// ENTER KEY SUPPORT
// =========================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        document
        .getElementById("message")
        .addEventListener("keydown", e => {

            if (e.key === "Enter") {
                sendMessage();
            }
        });

        document
        .getElementById("key")
        .addEventListener("keydown", e => {

            if (e.key === "Enter") {
                start();
            }
        });
    }
);
```
