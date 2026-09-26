/*
 *  Texter - Drawing with Text.
 *  - Ported from demo in Generative Design book - http://www.generative-gestaltung.de
 *  - generative-gestalung.de original licence: http://www.apache.org/licenses/LICENSE-2.0
 *
 *  - Modified and maintained by Tim Holman - tholman.com - @twholman
 *  - Modidied by Petr Novák - better save functionality, undo/redo, import image, canvas stability
 */

function Texter() {
  var _this = this;

  var history = [];
  var historyStep = -1;
  var maxHistory = 20;

  // Application variables
  position = { x: 0, y: window.innerHeight / 2 };
  textIndex = 0;
  this.textColor = "#000000";
  this.bgColor = "#ffffff";
  this.minFontSize = 8;
  this.maxFontSize = 300;
  this.angleDistortion = 0.01;
  this.pickColorMode = false;
  this.currentImportMode = 'none';
  var magnifierCanvas = null;
  var magCtx = null;

  var queryString = window.location.search;
  var urlParams = new URLSearchParams(queryString);
  var urlText = urlParams.get('text')

  this.text = urlText || 
    "There was a table set out under a tree in front of the house, and the March Hare and the Hatter were having tea at it: a Dormouse was sitting between them, fast asleep, and the other two were using it as a cushion, resting their elbows on it, and talking over its head. 'Very uncomfortable for the Dormouse,' thought Alice; 'only, as it's asleep, I suppose it doesn't mind.'";

  // Drawing Variables
  canvas = null;
  context = null;
  mouse = { x: 0, y: 0, down: false };

  bgCanvas = null;
  bgContext = null;

  var saveState = function () {
    if (historyStep < history.length - 1) {
      history.length = historyStep + 1;
    }
    
    history.push(context.getImageData(0, 0, canvas.width, canvas.height));
    
    if (history.length > maxHistory + 1) {
      history.shift();
    } else {
      historyStep++;
    }
  };

  var restoreState = function () {
    var state = history[historyStep];
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.putImageData(state, 0, 0);
    context.fillStyle = _this.textColor;
  };

  var undo = function () {
    if (historyStep > 0) {
      historyStep--;
      restoreState();
    }
  };

  var redo = function () {
    if (historyStep < history.length - 1) {
      historyStep++;
      restoreState();
    }
  };

  this.initialize = function () {
    canvas = document.getElementById("canvas");
    context = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    canvas.addEventListener("mousedown", onDown, false);
    canvas.addEventListener("touchstart", onDown, false);

    window.addEventListener("mousemove", onMove, false);
    window.addEventListener("mouseup", onUp, false);
    
    window.addEventListener("touchmove", onMove, false);
    window.addEventListener("touchend", onUp, false);
    window.addEventListener("touchcancel", onUp, false);

    bgCanvas = document.createElement("canvas");
    bgContext = bgCanvas.getContext("2d");
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;
    _this.setBackground(_this.bgColor);

    window.onresize = function (event) {
      var newWidth = Math.max(canvas.width, window.innerWidth);
      var newHeight = Math.max(canvas.height, window.innerHeight);

      var tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      tempCanvas.getContext("2d").drawImage(canvas, 0, 0);

      canvas.width = newWidth;
      canvas.height = newHeight;
      bgCanvas.width = newWidth;
      bgCanvas.height = newHeight;

      _this.setBackground(_this.bgColor);
      context.drawImage(tempCanvas, 0, 0);
      
      context.fillStyle = _this.textColor;
    };

    window.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey) { // Podporuje Windows (Ctrl) i Mac (Cmd)
        if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          undo();
        } else if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          redo();
        }
      }
    });

    saveState();

    magnifierCanvas = document.createElement('canvas');
    magnifierCanvas.width = 120;
    magnifierCanvas.height = 120;
    magnifierCanvas.style.position = 'fixed';
    magnifierCanvas.style.borderRadius = '50%';
    magnifierCanvas.style.border = '3px solid rgba(0,0,0,0.6)';
    magnifierCanvas.style.boxShadow = '0 5px 15px rgba(0,0,0,0.4)';
    magnifierCanvas.style.pointerEvents = 'none';
    magnifierCanvas.style.zIndex = '10000';
    magnifierCanvas.style.display = 'none';
    document.body.appendChild(magnifierCanvas);
    
    magCtx = magnifierCanvas.getContext('2d');

    update();
  };

  var update = function () {
    requestAnimationFrame(update);
    draw();
  };

  var draw = function () {
    if (mouse.down) {
      var newDistance = distance(position, mouse);
      var fontSize = _this.minFontSize + newDistance / 2;

      if (fontSize > _this.maxFontSize) {
        fontSize = _this.maxFontSize;
      }

      var letter = _this.text[textIndex];
      var stepSize = textWidth(letter, fontSize);

      if (newDistance > stepSize) {
        var angle = Math.atan2(mouse.y - position.y, mouse.x - position.x);

        context.font = fontSize + "px Georgia";

        context.save();
        context.translate(position.x, position.y);
        context.rotate(
          angle +
            (Math.random() * (_this.angleDistortion * 2) -
              _this.angleDistortion)
        );
        context.fillText(letter, 0, 0);
        context.restore();

        textIndex++;
        if (textIndex > _this.text.length - 1) {
          textIndex = 0;
        }

        position.x = position.x + Math.cos(angle) * stepSize;
        position.y = position.y + Math.sin(angle) * stepSize;
      }
    }
  };

  var pickColorFromCanvas = function (x, y) {
    var pixel = context.getImageData(x - window.pageXOffset, y - window.pageYOffset, 1, 1).data;
    var hex;
    
    if (pixel[3] === 0) {
      hex = _this.bgColor;
    } else {
      var r = pixel[0], g = pixel[1], b = pixel[2];
      hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    
    _this.applyNewColor(hex);
    _this.pickColorMode = false;
    if (magnifierCanvas) magnifierCanvas.style.display = 'none';
    
    if (typeof _this.onColorPicked === "function") {
      _this.onColorPicked();
    }
  };
  
  var distance = function (pt, pt2) {
    var xs = 0;
    var ys = 0;

    xs = pt2.x - pt.x;
    xs = xs * xs;

    ys = pt2.y - pt.y;
    ys = ys * ys;

    return Math.sqrt(xs + ys);
  };

  var onDown = function (event) {
    const eventObject = event.touches && event.touches.item(0) || event;
    
    if (_this.isImporting && typeof _this.canvasClickHandler === 'function') {
      _this.canvasClickHandler(eventObject.pageX, eventObject.pageY);
      return;
    }

    if (_this.pickColorMode || event.altKey) {
      pickColorFromCanvas(eventObject.pageX, eventObject.pageY);
      return;
    }

    mouse.down = true;
    position.x = eventObject.pageX;
    position.y = eventObject.pageY;
    mouse.x = eventObject.pageX;
    mouse.y = eventObject.pageY;
  };

  var onUp = function () {
    if (mouse.down) {
      mouse.down = false;
      saveState();
    }
  };

  var updateMagnifier = function(pageX, pageY) {
    if (!magnifierCanvas) return;

    var show = _this.pickColorMode || (_this.isImporting && _this.currentImportMode !== 'none');
    if (!show) {
      magnifierCanvas.style.display = 'none';
      return;
    }

    magnifierCanvas.style.display = 'block';

    var magSize = magnifierCanvas.width;
    var left = pageX - window.scrollX + 20;
    var top = pageY - window.scrollY + 20;
    
    if (left + magSize > window.innerWidth) left = pageX - window.scrollX - magSize - 20;
    if (top + magSize > window.innerHeight) top = pageY - window.scrollY - magSize - 20;

    magnifierCanvas.style.left = left + 'px';
    magnifierCanvas.style.top = top + 'px';

    var zoom = 7;
    var srcSize = magSize / zoom;

    magCtx.clearRect(0, 0, magSize, magSize);
    magCtx.fillStyle = _this.bgColor; 
    magCtx.fillRect(0, 0, magSize, magSize);
    magCtx.imageSmoothingEnabled = false;

    magCtx.drawImage(
      canvas,
      pageX - window.scrollX - srcSize / 2,
      pageY - window.scrollY - srcSize / 2,
      srcSize, srcSize,
      0, 0, magSize, magSize
    );

    magCtx.strokeStyle = 'red';
    magCtx.lineWidth = 1.5;
    magCtx.beginPath();
    magCtx.moveTo(magSize / 2, 0); magCtx.lineTo(magSize / 2, magSize);
    magCtx.moveTo(0, magSize / 2); magCtx.lineTo(magSize, magSize / 2);
    magCtx.stroke();
    
    magCtx.strokeRect((magSize/2) - (zoom/2), (magSize/2) - (zoom/2), zoom, zoom);
  };

  var onMove = function (event) {
    const eventObject = event.touches && event.touches.item(0) || event;
    mouse.x = eventObject.pageX;
    mouse.y = eventObject.pageY;
    
    updateMagnifier(mouse.x, mouse.y);
    
    draw();
  };

  var textWidth = function (string, size) {
    context.font = size + "px Georgia";

    if (context.fillText) {
      return context.measureText(string).width;
    } else if (context.mozDrawText) {
      return context.mozMeasureText(string);
    }
  };

  this.clear = function () {
    canvas.width = canvas.width;
    context.fillStyle = _this.textColor;
    saveState();
  };

  this.applyNewColor = function (value) {
    _this.textColor = value;
    context.fillStyle = _this.textColor;
  };

  this.setBackground = function (value) {
    _this.bgColor = value;
    canvas.style.backgroundColor = value;
  };

  this.onTextChange = function () {
    textIndex = 0;
  };

  this.save = function () {
    // Příprava barvy pozadí
    bgContext.rect(0, 0, bgCanvas.width, bgCanvas.height);
    bgContext.fillStyle = _this.bgColor;
    bgContext.fill();

    bgContext.drawImage(canvas, 0, 0);

    var link = document.createElement('a');
    link.download = 'kresba.png';
    link.href = bgCanvas.toDataURL("image/png");
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  this.isImporting = false;
  this.canvasClickHandler = null;

  this.importImage = function () {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*'; 
    
    input.onchange = function (event) {
      var file = event.target.files[0];
      if (!file) return;
      
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          _this.startImageImport(img);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    };
    
    input.click();
  };

  this.startImageImport = function(img) {
    _this.isImporting = true;

    var importImgCanvas = document.createElement("canvas");
    importImgCanvas.width = canvas.width;
    importImgCanvas.height = canvas.height;
    var importImgCtx = importImgCanvas.getContext("2d");
    importImgCtx.drawImage(img, 0, 0);

    if (typeof historyStep !== 'undefined' && historyStep < 0 && typeof saveState === "function") saveState();
    var baseState = (typeof history !== 'undefined') ? history[historyStep] : null;
    
    var drawPreview = function() {
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (baseState) context.putImageData(baseState, 0, 0);
      context.drawImage(importImgCanvas, 0, 0);
    };
    drawPreview();

        var overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '30px';
        overlay.style.left = '50%';
        overlay.style.transform = 'translateX(-50%)';
        overlay.style.background = '#ffffff';
        overlay.style.padding = '20px 25px';
        overlay.style.border = '4px solid #1ed36f';
        overlay.style.borderRadius = '12px';
        overlay.style.zIndex = '9999';
        overlay.style.boxShadow = '0 15px 40px rgba(0,0,0,0.3)';
        overlay.style.textAlign = 'left';
        overlay.style.fontFamily = 'sans-serif';
        overlay.style.width = '380px';
        
        overlay.innerHTML = `
          <h3 style="margin: 0 0 10px 0; font-size: 20px; color: #111; text-align: center;">🖼️ Image Import Setup</h3>
          <p style="font-size: 14px; color: #555; margin-bottom: 20px; text-align: center; line-height: 1.4;">
            Select a background extraction mode below.<br><b>Click directly on the image</b> to pick a color. It will be converted into an editable canvas background, making those parts of the image transparent.
          </p>
          
          <div id="btn-keep" style="margin: 10px 0; padding: 12px; cursor: pointer; border: 2px solid; border-radius: 8px; transition: 0.2s;">
            <strong style="display: block; font-size: 16px; margin-bottom: 4px;">1. Keep Original</strong>
            <span style="font-size: 13px; opacity: 0.9;">Import the image as it is. No background will be extracted.</span>
          </div>
          
          <div id="btn-flood" style="margin: 10px 0; padding: 12px; cursor: pointer; border: 2px solid; border-radius: 8px; transition: 0.2s;">
            <strong style="display: block; font-size: 16px; margin-bottom: 4px;">2. Magic Wand (Local)</strong>
            <span style="font-size: 13px; opacity: 0.9;">Click to select a connected area. Its color becomes the canvas background.</span>
          </div>
          
          <div id="btn-global" style="margin: 10px 0; padding: 12px; cursor: pointer; border: 2px solid; border-radius: 8px; transition: 0.2s;">
            <strong style="display: block; font-size: 16px; margin-bottom: 4px;">3. Global Extraction</strong>
            <span style="font-size: 13px; opacity: 0.9;">Click to select a color. It becomes the canvas background everywhere in the image.</span>
          </div>
          
          <button id="btn-done" style="margin-top: 20px; width: 100%; padding: 14px; font-size: 16px; font-weight: bold; background: #1ed36f; color: white; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 10px rgba(30, 211, 111, 0.4);">Finish Import</button>
        `;
        document.body.appendChild(overlay);

        var setActiveBtn = function(id) {
          ['btn-keep', 'btn-flood', 'btn-global'].forEach(function(btnId) {
            var btn = document.getElementById(btnId);
            if (btnId === id) {
              btn.style.background = '#e8f9f0';
              btn.style.borderColor = '#1ed36f';
              btn.style.color = '#0c6633';
            } else {
              btn.style.background = '#f5f5f5';
              btn.style.borderColor = '#ddd';
              btn.style.color = '#444';
            }
          });
        };

        document.getElementById('btn-keep').onclick = function() { _this.currentImportMode = 'none'; setActiveBtn('btn-keep'); magnifierCanvas.style.display = 'none'; };
        document.getElementById('btn-flood').onclick = function() { _this.currentImportMode = 'flood'; setActiveBtn('btn-flood'); };
        document.getElementById('btn-global').onclick = function() { _this.currentImportMode = 'global'; setActiveBtn('btn-global'); };
        setActiveBtn('btn-keep'); // Výchozí volba

    document.getElementById('btn-done').onclick = function() {
      _this.isImporting = false;
      document.body.removeChild(overlay);
      context.fillStyle = _this.textColor;
      if (magnifierCanvas) magnifierCanvas.style.display = 'none';
      if (typeof saveState === "function") saveState();
      _this.canvasClickHandler = null;
    };

    _this.canvasClickHandler = function(pageX, pageY) {
      if (_this.currentImportMode === 'none') return;

      var rect = canvas.getBoundingClientRect();
      var x = Math.floor(pageX - rect.left - window.scrollX);
      var y = Math.floor(pageY - rect.top - window.scrollY);

      var imgData = importImgCtx.getImageData(0, 0, importImgCanvas.width, importImgCanvas.height);
      var data = imgData.data;

      var pxIdx = ((y * importImgCanvas.width) + x) * 4;
      var r = data[pxIdx], g = data[pxIdx+1], b = data[pxIdx+2], a = data[pxIdx+3];
      
      if (a === 0) return;

      var hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
      _this.setBackground(hex);
      
      if (typeof gui !== 'undefined') {
        gui.__controllers.forEach(function(c) { 
          if (c.property === 'bgColor') c.updateDisplay(); 
        });
      }

      var tolerance = 35;
      var w = importImgCanvas.width;
      var h = importImgCanvas.height;

      if (_this.currentImportMode === 'global') {
         for (var i = 0; i < data.length; i += 4) {
           if (data[i+3] > 0 && Math.abs(data[i] - r) <= tolerance && 
               Math.abs(data[i+1] - g) <= tolerance && 
               Math.abs(data[i+2] - b) <= tolerance) {
             data[i+3] = 0;
           }
         }
      } else if (_this.currentImportMode   === 'flood') {
         var visited = new Uint8Array(w * h);
         var stack = [y * w + x];
         visited[y * w + x] = 1;

         var isMatch = function(idx) {
           return data[idx+3] > 0 && 
                  Math.abs(data[idx] - r) <= tolerance &&
                  Math.abs(data[idx+1] - g) <= tolerance &&
                  Math.abs(data[idx+2] - b) <= tolerance;
         };

         while (stack.length > 0) {
           var p = stack.pop();
           data[p * 4 + 3] = 0;

           var px = p % w;
           var py = Math.floor(p / w);

           if (py > 0 && !visited[p - w] && isMatch((p - w) * 4)) { visited[p - w] = 1; stack.push(p - w); }
           if (py < h - 1 && !visited[p + w] && isMatch((p + w) * 4)) { visited[p + w] = 1; stack.push(p + w); }
           if (px > 0 && !visited[p - 1] && isMatch((p - 1) * 4)) { visited[p - 1] = 1; stack.push(p - 1); }
           if (px < w - 1 && !visited[p + 1] && isMatch((p + 1) * 4)) { visited[p + 1] = 1; stack.push(p + 1); }
         }
      }

      importImgCtx.putImageData(imgData, 0, 0);
      drawPreview();
    };
  };
}
