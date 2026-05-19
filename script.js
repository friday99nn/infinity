const BASE =
"https://friday99nn.pythonanywhere.com";

const API =
BASE + "/infinity";

const socket =
io(BASE);

let username = "";
let otherName = "";

let loadedIds = new Set();

function formatTime() {
    return new Date().toLocaleString();
}

function fileUrl(path) {
    return BASE + path;
}

function scrollBottom() {

    const area =
    document.getElementById("chatArea");

    area.scrollTop =
    area.scrollHeight;
}

async function start() {

    const key =
    document.getElementById("key")
    .value
    .trim();

    if (!key) {
        alert("Enter key");
        return;
    }

    const fd = new FormData();

    fd.append("key", key);

    try {

        const res =
        await fetch(`${API}/start`, {
            method: "POST",
            body: fd
        });

        const data =
        await res.json();

        if (data.status === "invalid") {

            alert("Invalid key");

            return;
        }

        username = data.username;
        otherName = data.other;

        document.getElementById("otherName")
        .innerText = otherName;

        document.getElementById("startup")
        .style.display = "none";

        document.getElementById("app")
        .style.display = "flex";

        loadChat();

    } catch(err) {

        console.log(err);

        alert("Server error");
    }
}

function renderMessage(data) {

    const wrap =
    document.createElement("div");

    wrap.className =
    data.username === username
    ? "msg-wrapper me"
    : "msg-wrapper other";

    const bubble =
    document.createElement("div");

    bubble.className = "bubble";

    if (data.image) {

        const img =
        document.createElement("img");

        img.src =
        fileUrl(data.image);

        img.className =
        "chat-img";

        bubble.appendChild(img);
    }

    if (data.audio) {

        const audio =
        document.createElement("audio");

        audio.controls = true;

        audio.src =
        fileUrl(data.audio);

        bubble.appendChild(audio);
    }

    if (data.video) {

        const video =
        document.createElement("video");

        video.controls = true;

        video.src =
        fileUrl(data.video);

        bubble.appendChild(video);
    }

    if (data.message) {

        const text =
        document.createElement("div");

        text.className =
        "msg-text";

        text.innerText =
        data.message;

        bubble.appendChild(text);
    }

    const time =
    document.createElement("div");

    time.className =
    "msg-time";

    time.innerText =
    data.time;

    bubble.appendChild(time);

    wrap.appendChild(bubble);

    return wrap;
}

async function loadChat() {

    const res =
    await fetch(`${API}/load_chat`);

    const messages =
    await res.json();

    const container =
    document.getElementById("messages");

    container.innerHTML = "";

    loadedIds.clear();

    messages.forEach(msg => {

        loadedIds.add(msg.id);

        container.appendChild(
            renderMessage(msg)
        );
    });

    scrollBottom();
}

async function sendMessage() {

    const message =
    document.getElementById("message")
    .value;

    const image =
    document.getElementById("imageInput")
    .files[0];

    const video =
    document.getElementById("videoInput")
    .files[0];

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

    try {

        const res =
        await fetch(`${API}/save_message`, {
            method: "POST",
            body: fd
        });

        const data =
        await res.json();

        if (data.status === "sent") {

            appendMessage(data.message);

            document.getElementById("message").value = "";

            document.getElementById("imageInput").value = "";

            document.getElementById("videoInput").value = "";
        }

    } catch(err) {

        console.log(err);
    }
}

function appendMessage(msg) {

    if (loadedIds.has(msg.id)) return;

    loadedIds.add(msg.id);

    document.getElementById("messages")
    .appendChild(renderMessage(msg));

    scrollBottom();
}

socket.on("new-message", msg => {

    appendMessage(msg);
});

async function recordVoice() {

    const stream =
    await navigator.mediaDevices.getUserMedia({
        audio: true
    });

    const recorder =
    new MediaRecorder(stream);

    let chunks = [];

    recorder.ondataavailable = e => {

        chunks.push(e.data);
    };

    recorder.onstop = async () => {

        const blob =
        new Blob(chunks, {
            type: "audio/webm"
        });

        const fd =
        new FormData();

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
    };

    recorder.start();

    alert("Recording 5 seconds");

    setTimeout(() => {

        recorder.stop();

    }, 5000);
}

// ======================
// SIMPLE VIDEO CALL
// ======================

let peerConnection;

const servers = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
};

async function startCall() {

    peerConnection =
    new RTCPeerConnection(servers);

    const stream =
    await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
    });

    stream.getTracks().forEach(track => {

        peerConnection.addTrack(track, stream);
    });

    peerConnection.onicecandidate = event => {

        if (event.candidate) {

            socket.emit(
                "ice-candidate",
                event.candidate
            );
        }
    };

    const offer =
    await peerConnection.createOffer();

    await peerConnection.setLocalDescription(
        offer
    );

    socket.emit("call-user", offer);

    alert("Calling...");
}

socket.on("incoming-call", async offer => {

    const accept =
    confirm("Incoming call");

    if (!accept) return;

    peerConnection =
    new RTCPeerConnection(servers);

    const stream =
    await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
    });

    stream.getTracks().forEach(track => {

        peerConnection.addTrack(track, stream);
    });

    await peerConnection.setRemoteDescription(
        offer
    );

    const answer =
    await peerConnection.createAnswer();

    await peerConnection.setLocalDescription(
        answer
    );

    socket.emit("answer-call", answer);
});

socket.on("call-answered", async answer => {

    await peerConnection.setRemoteDescription(
        answer
    );
});

socket.on("ice-candidate", async candidate => {

    if (peerConnection) {

        await peerConnection.addIceCandidate(
            candidate
        );
    }
});

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
