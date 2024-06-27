var bounding_box_colors = {};

var user_confidence = 0.6;

// Update the colors in this list to set the bounding box colors
var color_choices = [
  "#C7FC00",
  "#FF00FF",
  "#8622FF",
  "#FE0056",
  "#00FFCE",
  "#FF8000",
  "#00B7EB",
  "#FFFF00",
  "#0E7AFE",
  "#FFABAB",
  "#0000FF",
  "#CCCCCC",
];

var canvas_painted = false;
var canvas = document.getElementById("video_canvas");
var ctx = canvas.getContext("2d");

var model = null;

let sound_alert = new Audio("incorrect-buzzer-sound-147336.mp3");

// Array to store the log of predictions
var log_predictions = [];
var last_predictions = [];

// Interval time for updating log (in milliseconds)
var log_interval = 5000;

// Function to check if there are new predictions
function hasNewPredictions(predictions) {
  if (predictions.length !== last_predictions.length) return true;

  for (let i = 0; i < predictions.length; i++) {
    if (
      predictions[i].class !== last_predictions[i].class ||
      predictions[i].confidence !== last_predictions[i].confidence
    ) {
      return true;
    }
  }

  return false;
}

function detectFrame() {
  if (!model) return requestAnimationFrame(detectFrame);

  model.detect(video).then(function (predictions) {
    console.log(predictions);

    // // PLASTIC CATEGORY
    // // Remove if webcam is pointing to plastic waste bin
    // _.each(predictions, function (prediction) {
    //   if (
    //     prediction.class == "Plastic bag" ||
    //     prediction.class == "Plastic bottle"
    //   ) {
    //     sound_alert.play();
    //   }
    // });

    // ORGANIC
    // Remove if webcam is pointing to organic waste bin
    _.each(predictions, function (prediction) {
      if (prediction.class == "Organic") {
        sound_alert.play();
      }
    });

    // OTHERS
    // Remove if webcam is pointing to others waste bin
    _.each(predictions, function (prediction) {
      if (
        prediction.class == "Container for household chemicals" ||
        prediction.class == "Aluminum can" ||
        prediction.class == "Glass bottle" ||
        prediction.class == "Cardboard"
      ) {
        sound_alert.play();
      }
    });

    // Only save and display log if there are new predictions
    if (hasNewPredictions(predictions)) {
      last_predictions = predictions.slice(); // Save the current predictions
      saveLog(predictions);
    }

    if (!canvas_painted) {
      var video_start = document.getElementById("video1");
      canvas.style.width = video_start.width + "px";
      canvas.style.height = video_start.height + "px";
      canvas.width = video_start.width;
      canvas.height = video_start.height;
      // adjust top to margin position of video

      canvas.top = video_start.top;
      canvas.left = video_start.left;
      canvas.style.top = video_start.top + "px";
      canvas.style.left = video_start.left + "px";
      canvas.style.position = "absolute";
      video_start.style.display = "block";
      canvas.style.display = "absolute";
      canvas_painted = true;

      var loading = document.getElementById("loading");
      loading.style.display = "none";
    }
    requestAnimationFrame(detectFrame);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (video) {
      drawBoundingBoxes(predictions, ctx);
    }
  });
}

function drawBoundingBoxes(predictions, ctx) {
  // For each prediction, choose or assign a bounding box color choice,
  // then apply the requisite scaling so bounding boxes appear exactly
  // around a prediction.

  // If you want to do anything with predictions, start from this function.
  // For example, you could display them on the web page, check off items on a list,
  // or store predictions somewhere.

  for (var i = 0; i < predictions.length; i++) {
    var confidence = predictions[i].confidence;

    console.log(user_confidence);

    if (confidence < user_confidence) {
      continue;
    }

    if (predictions[i].class in bounding_box_colors) {
      ctx.strokeStyle = bounding_box_colors[predictions[i].class];
    } else {
      var color =
        color_choices[Math.floor(Math.random() * color_choices.length)];
      ctx.strokeStyle = color;
      // remove color from choices
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
    ctx.fillText(
      prediction.class + " " + Math.round(confidence * 100) + "%",
      x,
      y - 10
    );
  }
}

function webcamInference() {
  // Ask for webcam permissions, then run main application.
  var loading = document.getElementById("loading");
  loading.style.display = "block";

  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "environment" } })
    .then(function (stream) {
      video = document.createElement("video");
      video.srcObject = stream;
      video.id = "video1";

      // hide video until the web stream is ready
      video.style.display = "none";
      video.setAttribute("playsinline", "");

      document.getElementById("video_canvas").after(video);

      video.onloadeddata = function () {
        video.play();
      };

      // on full load, set the video height and width
      video.onplay = function () {
        height = video.videoHeight;
        width = video.videoWidth;

        // scale down video by 0.75

        height = height * 0.75;
        width = width * 0.75;

        width = Math.round(width);
        height = Math.round(height);

        video.setAttribute("width", width);
        video.setAttribute("height", height);
        video.style.width = width + "px";
        video.style.height = height + "px";

        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
        canvas.width = width;
        canvas.height = height;

        document.getElementById("video_canvas").style.display = "block";
      };

      ctx.scale(1, 1);

      // Load the Roboflow model using the publishable_key set in index.html
      // and the model name and version set at the top of this file
      roboflow
        .auth({
          publishable_key: publishable_key,
        })
        .load({
          model: MODEL_NAME,
          version: MODEL_VERSION,
        })
        .then(function (m) {
          model = m;
          // Images must have confidence > CONFIDENCE_THRESHOLD to be returned by the model
          m.configure({ threshold: CONFIDENCE_THRESHOLD });
          // Start inference
          detectFrame();
        });
    })
    .catch(function (err) {
      console.log(err);
    });
}

function changeConfidence() {
  user_confidence = document.getElementById("confidence").value / 100;
}

document
  .getElementById("confidence")
  .addEventListener("input", changeConfidence);

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
  logContainer.innerHTML = ""; // Clear previous log

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

// Schedule the log update every 5 seconds
setInterval(function () {
  if (last_predictions.length > 0) {
    displayLog();
  }
}, log_interval);
