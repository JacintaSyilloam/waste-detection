var bounding_box_colors = {};

var user_confidence = 0.6;
var color_choices = [
    "#C7FC00", "#FF00FF", "#8622FF", "#FE0056", "#00FFCE",
    "#FF8000", "#00B7EB", "#FFFF00", "#0E7AFE", "#FFABAB",
    "#0000FF", "#CCCCCC"
];

var canvas_painted = false;
var canvas = document.getElementById("video_canvas");
var ctx = canvas.getContext("2d");

var model = null;
let sound_alert = new Audio("incorrect-buzzer-sound-147336.mp3");

var log_predictions = [];
var last_predictions = [];
var log_interval = 5000;

const publishable_key = 'YOUR_PUBLISHABLE_KEY';
const MODEL_NAME = 'YOUR_MODEL_NAME';
const MODEL_VERSION = 'YOUR_MODEL_VERSION';
const CONFIDENCE_THRESHOLD = 0.5;

function hasNewPredictions(predictions) {
    if (predictions.length !== last_predictions.length) return true;

    for (let i = 0; i < predictions.length; i++) {
        if (predictions[i].class !== last_predictions[i].class ||
            predictions[i].confidence !== last_predictions[i].confidence) {
            return true;
        }
    }
    return false;
}

function detectFrame() {
    if (!model) return requestAnimationFrame(detectFrame);

    const img = document.getElementById("streamImage");

    model.detect(img).then(function (predictions) {
        console.log(predictions);

        predictions.forEach(function (prediction) {
            if (prediction.class == "Plastic bag" || prediction.class == "Plastic bottle") {
                sound_alert.play();
            }
        });

        predictions.forEach(function (prediction) {
            if (prediction.class == "Organic") {
                sound_alert.play();
            }
        });

        predictions.forEach(function (prediction) {
            if (prediction.class == "Container for household chemicals" ||
                prediction.class == "Aluminum can" ||
                prediction.class == "Glass bottle" ||
                prediction.class == "Cardboard") {
                sound_alert.play();
            }
        });

        if (hasNewPredictions(predictions)) {
            last_predictions = predictions.slice();
            saveLog(predictions);
        }

        if (!canvas_painted) {
            var img_start = document.getElementById("streamImage");
            canvas.style.width = img_start.width + "px";
            canvas.style.height = img_start.height + "px";
            canvas.width = img_start.width;
            canvas.height = img_start.height;

            canvas.top = img_start.top;
            canvas.left = img_start.left;
            canvas.style.top = img_start.top + "px";
            canvas.style.left = img_start.left + "px";
            canvas.style.position = "absolute";
            img_start.style.display = "block";
            canvas.style.display = "absolute";
            canvas_painted = true;

            var loading = document.getElementById("loading");
            loading.style.display = "none";
        }

        requestAnimationFrame(detectFrame);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (img) {
            drawBoundingBoxes(predictions, ctx);
        }
    });
}

function drawBoundingBoxes(predictions, ctx) {
    for (var i = 0; i < predictions.length; i++) {
        var confidence = predictions[i].confidence;

        if (confidence < user_confidence) {
            continue;
        }

        if (predictions[i].class in bounding_box_colors) {
            ctx.strokeStyle = bounding_box_colors[predictions[i].class];
        } else {
            var color = color_choices[Math.floor(Math.random() * color_choices.length)];
            ctx.strokeStyle = color;
            color_choices.splice(color_choices.indexOf(color), 1);

            bounding_box_colors[predictions[i].class] = color;
        }

        var prediction = predictions[i];
        var x = prediction.bbox.x - prediction.bbox.width / 2;
        var y = prediction.bbox.y - prediction.bbox.height / 2;
        var width = prediction.bbox.width;
        var height = prediction.bbox.height;

        ctx.rect(x, y, width, height);

        ctx.fillStyle = "rgba(0, 0, 0, 0)";
        ctx.fill();

        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = "4";
        ctx.strokeRect(x, y, width, height);
        ctx.font = "25px Arial";
        ctx.fillText(prediction.class + " " + Math.round(confidence * 100) + "%", x, y - 10);
    }
}

function webcamInference() {
    var loading = document.getElementById("loading");
    loading.style.display = "block";

    var img = document.getElementById("streamImage");

    img.onload = function() {
        canvas.style.width = img.width + "px";
        canvas.style.height = img.height + "px";
        canvas.width = img.width;
        canvas.height = img.height;

        document.getElementById("video_canvas").style.display = "block";
        ctx.scale(1, 1);

        roboflow.auth({ publishable_key: publishable_key })
            .load({ model: MODEL_NAME, version: MODEL_VERSION })
            .then(function (m) {
                model = m;
                m.configure({ threshold: CONFIDENCE_THRESHOLD });
                detectFrame();
            });
    };
}

function changeConfidence() {
    user_confidence = document.getElementById("confidence").value / 100;
}

document.getElementById("confidence").addEventListener("input", changeConfidence);

webcamInference();

function saveLog(predictions) {
    predictions.forEach(function (prediction) {
        if (prediction.confidence >= user_confidence) {
            var log_entry = {
                timestamp: new Date().toISOString(),
                class: prediction.class,
                confidence: prediction.confidence,
            };
            log_predictions.push(log_entry);
        }
    });
    displayLog();
}

function displayLog() {
    var logContainer = document.getElementById("log_container");
    logContainer.innerHTML = ""; 

    log_predictions.forEach(function (log_entry) {
        var logDiv = document.createElement("div");
        logDiv.className = "log-entry";
        logDiv.innerHTML =
            "<strong>Timestamp:</strong> " + log_entry.timestamp + "<br>" +
            "<strong>Class:</strong> " + log_entry.class + "<br>" +
            "<strong>Confidence:</strong> " + (log_entry.confidence * 100).toFixed(2) + "%" + "<br>" +
            "<strong>Detected on: </strong>" + "plastic bin";
        logContainer.appendChild(logDiv);
    });
}

setInterval(function () {
    if (last_predictions.length > 0) {
        displayLog();
    }
}, log_interval);