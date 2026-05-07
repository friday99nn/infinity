// =============================================
// CONFIG
// =============================================
const API = "https://friday99nn.pythonanywhere.com/infinity";
const POLL_INTERVAL = 3000; // ms

// =============================================
// STATE
// =============================================
let login       = false;
let username    = "";
let otherName   = "";
let lastMsgCount = 0;
let selectedImage = null; // base64 string

// =============================================
// HELPERS
// =============================================
function showLoading()  { document.getElementById("loadingOverlay").classList.add("show"); }
function hideLoading()  { document.getElementById("loadingOverlay").classList.remove("show"); }

function scrollToBottom(smooth = true) {
    const area = document.getElementById("chatArea");
    area.scrollTo({ top: area.scrollHeight, behavior: smooth ? "smooth" : "instant" });
}

function formatTime() {
    return new Date().toLocaleString("en-GB", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true
    }).toUpperCase().replace(",", "");
}

// =============================================
// LOGIN
// =============================================
function start() {
    const keyEl  = document.getElementById("key");
    const errEl  = document.getElementById("keyError");
    const key    = keyEl.value.trim();

    keyEl.classList.remove("error");
    errEl.classList.remove("show");

    if (!key) {
        keyEl.classList.add("error");
        return;
    }
    if (!navigator.onLine) {
        alert("No internet connection.");
        return;
    }

    const fd = new FormData();
    fd.append("key", key);

    showLoading();

    const timeout = setTimeout(() => {
        hideLoading();
        alert("Request timed out. Check your connection.");
    }, 8000);

    fetch(`${API}/start`, { method: "POST", body: fd })
        .then(r => r.json())
        .then(data => {
            clearTimeout(timeout);
            hideLoading();

            if (data.status === "invalid") {
                keyEl.classList.add("error");
                errEl.classList.add("show");
                return;
            }

            username  = data.username;
            otherName = data.other;
            login     = true;

            // Set header info
            document.getElementById("otherName").textContent    = otherName;
            document.getElementById("otherInitial").textContent = otherName.charAt(0).toUpperCase();

            // Switch screens
            document.getElementById("startup").style.display = "none";
            const app = document.getElementById("app");
            app.style.display = "flex";

            // Load chat immediately
            loadChat(false);
        })
        .catch(err => {
            clearTimeout(timeout);
            hideLoading();
            console.error(err);
        });
}

// Allow pressing Enter on key input
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("key").addEventListener("keydown", e => {
        if (e.key === "Enter") start();
    });
});

// =============================================
// RENDER A SINGLE MESSAGE
// =============================================
function renderMessage(data) {
    const isMe = (data.username === username);
    const wrapper = document.createElement("div");
    wrapper.className = `msg-wrapper ${isMe ? "me" : "other"}`;
    wrapper.dataset.id = data.id || "";

    // Show name only for "other"
    if (!isMe) {
        const name = document.createElement("div");
        name.className = "msg-name";
        name.textContent = data.username;
        wrapper.appendChild(name);
    }

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    // IMAGE
    if (data.image) {
        const img = document.createElement("img");
        img.className = "chat-img";
        img.src = data.image;
        img.alt = "image";
        img.loading = "lazy";
        img.onclick = () => openLightbox(data.image);
        bubble.appendChild(img);
    }

    // TEXT
    if (data.message && data.message.trim()) {
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

// =============================================
// LOAD CHAT (POLLING)
// =============================================
function loadChat(smooth = true) {
    if (!login) return;

    const fd = new FormData();
    fd.append("username", username);

    fetch(`${API}/load_chat`, { method: "POST", body: fd })
        .then(r => r.json())
        .then(messages => {
            if (messages.length === lastMsgCount) return; // nothing new

            const container = document.getElementById("messages");
            const wasAtBottom = isAtBottom();

            // Only add new messages (avoid full re-render = no flicker)
            const existingIds = new Set(
                [...container.querySelectorAll(".msg-wrapper")].map(el => el.dataset.id)
            );

            let added = 0;
            messages.forEach(msg => {
                if (msg.id && existingIds.has(String(msg.id))) return;
                container.appendChild(renderMessage(msg));
                added++;
            });

            lastMsgCount = messages.length;

            if (added > 0 && (wasAtBottom || messages[messages.length - 1]?.username === username)) {
                scrollToBottom(smooth);
            }
        })
        .catch(err => console.error("Poll error:", err));
}

function isAtBottom() {
    const area = document.getElementById("chatArea");
    return area.scrollHeight - area.scrollTop - area.clientHeight < 80;
}

// Poll every 3 seconds
setInterval(() => loadChat(true), POLL_INTERVAL);

// =============================================
// SEND MESSAGE
// =============================================
function sendMessage() {
    const msgEl = document.getElementById("message");
    const message = msgEl.value.trim();

    if (!message && !selectedImage) return;

    const time = formatTime();

    // Optimistically render
    const tempId = "tmp_" + Date.now();
    const tempMsg = {
        id: tempId,
        username,
        message,
        image: selectedImage,
        time
    };
    const el = renderMessage(tempMsg);
    document.getElementById("messages").appendChild(el);
    scrollToBottom(true);

    // Clear inputs
    msgEl.value = "";
    clearImagePreview();

    const fd = new FormData();
    fd.append("username", username);
    fd.append("message", message);
    fd.append("time", time);
    if (selectedImage) {
        fd.append("image", selectedImage);
    }

    fetch(`${API}/save_message`, { method: "POST", body: fd })
        .then(r => r.json())
        .then(data => {
            // Update temp element's id so dedup works
            if (data.id) {
                el.dataset.id = String(data.id);
            }
            lastMsgCount++; // so poll won't re-render same message
        })
        .catch(err => console.error("Send error:", err));
}

// =============================================
// IMAGE HANDLING
// =============================================
function handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE) {
        alert("Image is too large. Please choose an image under 2MB.");
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        selectedImage = e.target.result; // base64 data URL

        // Compress if needed
        compressImage(selectedImage, 800, 0.7, compressed => {
            selectedImage = compressed;
            document.getElementById("previewImg").src = compressed;
            document.getElementById("imagePreview").classList.add("show");
        });
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    event.target.value = "";
}

function compressImage(src, maxDim, quality, callback) {
    const img = new Image();
    img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
            if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
            else                { width  = Math.round(width  * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = src;
}

function clearImagePreview() {
    selectedImage = null;
    document.getElementById("previewImg").src = "";
    document.getElementById("imagePreview").classList.remove("show");
}

// =============================================
// LIGHTBOX
// =============================================
function openLightbox(src) {
    document.getElementById("lightboxImg").src = src;
    document.getElementById("lightbox").classList.add("open");
}
function closeLightbox() {
    document.getElementById("lightbox").classList.remove("open");
}
// Close lightbox with Escape
document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeLightbox();
});
