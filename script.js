let logedin = false;
let currentUser = "";
const API_BASE = "https://friday99nn.pythonanywhere.com/infinity";

function start_loading() {
    document.querySelector(".loading").style.display = "inline-block";
}

function stop_loading() {
    document.querySelector(".loading").style.display = "none";
}

function login() {
    let keyInput = document.querySelector("#key");
    let formData = new FormData();
    formData.append("key", keyInput.value.trim());

    start_loading();

    fetch(`${API_BASE}/start`, { method: "POST", body: formData })
        .then(res => res.json())
        .then(data => {
            stop_loading();
            if (data.status === "ok") {
                currentUser = data.user;
                logedin = true;
                document.querySelector(".login-form").style.display = "none";
                document.querySelector("main").style.display = "flex";
                // document.querySelector(".background").style.display = "none";
                load_chat();
            } else {
                alert("Access Denied: Invalid Secret Key");
            }
        })
        .catch(() => {
            stop_loading();
            alert("Server connection failed.");
        });
}

function load_chat() {
    fetch(`${API_BASE}/load`, { method: "POST" })
        .then(res => res.json())
        .then(data => {
            const chatBox = document.querySelector(".chat");
            chatBox.innerHTML = "";
            data.forEach(msg => {
                const msgDiv = document.createElement("div");
                msgDiv.className = "msg-bubble";
                // Style differently if message is from "me"
                if (msg.user === currentUser) msgDiv.style.alignSelf = "flex-end";

                msgDiv.innerHTML = `<small>${msg.user}</small><p>${msg.message}</p>`;
                chatBox.appendChild(msgDiv);
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        });
}

function sendMessage() {
    let input = document.querySelector("#message");
    if (input.value.trim() === "") return;

    let formData = new FormData();
    formData.append("message", input.value);
    formData.append("user", currentUser);

    fetch(`${API_BASE}/send`, { method: "POST", body: formData })
        .then(() => {
            input.value = "";
            load_chat();
        });
}

// Check for new messages every 2 seconds
setInterval(() => { if (logedin) load_chat(); }, 2000);
