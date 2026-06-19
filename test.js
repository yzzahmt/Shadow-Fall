const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");

const dom = new JSDOM(html, {
    url: "file:///Users/ahmetyaz/Documents/Projeler/My_Game/index.html",
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true
});

// Mock canvas
dom.window.HTMLCanvasElement.prototype.getContext = function () {
    return {
        fillRect: function() {},
        clearRect: function() {},
        getImageData: function(x, y, w, h) {
            return { data: new Uint8ClampedArray(w * h * 4) };
        },
        putImageData: function() {},
        createImageData: function(){ return [] },
        setTransform: function(){},
        drawImage: function(){},
        save: function(){},
        fillText: function(){},
        restore: function(){},
        beginPath: function(){},
        moveTo: function(){},
        lineTo: function(){},
        closePath: function(){},
        stroke: function(){},
        translate: function(){},
        scale: function(){},
        rotate: function(){},
        arc: function(){},
        fill: function(){},
        measureText: function(){ return { width: 0 }; },
        transform: function(){},
        rect: function(){},
        clip: function(){},
    };
};

dom.window.alert = function(msg) {
    console.log("ALERT:", msg);
};

dom.window.addEventListener("error", (e) => {
    console.log("Caught Error:", e.error ? e.error.message : e.message);
    if (e.error && e.error.stack) {
        console.log("Stack:", e.error.stack);
    }
});
