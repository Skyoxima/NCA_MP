import { createCA } from './ca.js'

let circEmojis, bilatEmojis, asymmEmojis;
fetch('./emojis_2.json')
.then(response => response.json())
.then(data => {
  circEmojis = data["circular-ems"]
  bilatEmojis = data["symm-ems"]
  asymmEmojis = data["asymm-ems"]
})

function isInViewport(element) {
  var rect = element.getBoundingClientRect();
  var html = document.documentElement;
  var w = window.innerWidth || html.clientWidth;
  var h = window.innerHeight || html.clientHeight;
  return rect.top < h && rect.left < w && rect.bottom > 0 && rect.right > 0;
}

export function createDemo(divID, canvasID) {
    const root = document.getElementById(divID);
    const $ = (q) => root.querySelector(q);
    const $$ = (q) => root.querySelectorAll(q);

    //~ canvas properties
    const W=96, H=96;
    let demo;
    const modelDir = 'webgl_models8';
    let target = '🦋';
    let modelName = 'L2'
    let experiment = modelName + 'ex3';
    let paused = false;

    const canvas = $(canvasID);
    const gl = canvas.getContext("webgl");
    canvas.width = W * 5;
    canvas.height = H * 5;
    const speedLabels = ['1/60x', '1/10x', '1/2x', '1x', '2x', '4x', '<b>max</b>']
    
    function updateUI() {
      $$('#circular-selector *').forEach(e => {
        e.classList.add(e.id == target ? 'active' : 'inactive');
        e.classList.remove(e.id !== target ? 'active' : 'inactive');
      });
      $$('#bilateral-selector *').forEach(e => {
        e.classList.add(e.id == target ? 'active' : 'inactive');
        e.classList.remove(e.id !== target ? 'active' : 'inactive');
      });
      $$('#asymm-selector *').forEach(e => {
        e.classList.add(e.id == target ? 'active' : 'inactive');
        e.classList.remove(e.id !== target ? 'active' : 'inactive');
      });
    }

    function initUI() {
      function selectorInit(arr, selectorDiv) {
        for (let c of arr) {
          const btn = document.createElement('button')
          btn.id = c;
          btn.className = 'e-btn btn'
          btn.innerHTML += c
          btn.onclick = () => {
            target = c
            updateModel();
          }
          $(selectorDiv).appendChild(btn);
        }
      }
      selectorInit(circEmojis, "#circular-selector");
      selectorInit(bilatEmojis, "#bilateral-selector");
      selectorInit(asymmEmojis, "#asymm-selector");

      speedLabels.forEach(e => {
        const span = document.createElement('span')
        $('#ticks').appendChild(span)
        span.innerHTML = `|<br>`
        span.className = 'tickspan'
      })
      $('#reset').onclick = demo.reset;
      $("#circular-damage").onclick = demo.circularDamage
      $('#play-pause').onclick = (e) => {
        paused = !paused;
        console.log(e.currentTarget.classList.toggle('active'))
      };
      $("#Hu-mode").onclick = () => {
        modelName = 'HU';
        experiment = modelName + 'ex3';
        if(!$("#Hu-mode").classList.contains('active')) {
          $("#Hu-mode").classList.add('active');
          $("#L2-mode").classList.remove('active');
        } 
        updateModel();
      }
      $("#L2-mode").onclick = () => {
        modelName = 'L2';
        if(!$("#L2-mode").classList.contains('active')) {
          $("#L2-mode").classList.add('active');
          $("#Hu-mode").classList.remove('active');
        } 
        experiment = modelName + 'ex3';
        updateModel();
      }

      //~ translates the co-ordinates of clicks from the outside of the canvas to the inside
      function canvasToGrid(x, y) {
        const [w, h] = demo.gridSize;
        const gridX = Math.floor(x / canvas.clientWidth * w);
        const gridY = Math.floor(y / canvas.clientHeight * h);
        return [gridX, gridY];
      }
      function getMousePos(e) {
        return canvasToGrid(e.offsetX, e.offsetY);
      }
      
      //~ Mouse handlers
      let doubleClick = false;
      let justSeeded = false;

      function click(pos) {
        const [x, y] = pos;
        if (doubleClick) {
          //! here a check should come for collision
          demo.paint(x, y, 1, 'seed');
          doubleClick = false;
          justSeeded = true;
          setTimeout(() => { justSeeded = false; }, 100);
        } else {
          doubleClick = true;
          setTimeout(() => { 
            doubleClick = false; 
          }, 300);
          demo.paint(x, y, 4, 'clear');
        }
      }
      function move(pos) {
        const [x, y] = pos;
        if (!justSeeded) {
          demo.paint(x, y, 4, 'clear');
        }
      }

      canvas.onmousedown = e => {
        e.preventDefault();
        if (e.buttons == 1) {
          click(getMousePos(e));
        }
      }
      canvas.onmousemove = e => {
        e.preventDefault();
        if (e.buttons == 1) {
          move(getMousePos(e));
        }
      }
      updateUI();
    }

    //~ Initial loading and when another emoji is selected
    async function updateModel() {
      console.log(`${modelDir}/${modelName}/${experiment}_${target}.json`)
      const r = await fetch(`${modelDir}/${modelName}/${experiment}_${target}.json`);
      const model = await r.json();
      if (!demo) {
        demo = createCA(gl, model, [W, H]);
        initUI();
        requestAnimationFrame(render);
      } else {
        demo.setWeights(model);
        demo.reset();
      }
      updateUI();
    }
    updateModel();
  
    let lastDrawTime = 0;
    let stepsPerFrame = 1;
    let frameCount = 0;
  
    function render(time) {
      //* This one is responsible for browser resetting the render because the canvas element isn't in the viewport anymore
      if  (!isInViewport(canvas)) {
        requestAnimationFrame(render);
        return;
      }
      
      //~ controls both pause and speed
      if (!paused) {
        const speed = parseInt($("#speed").value);
        if (speed <= 0) {  // slow down by skipping steps
          const skip = [1, 2, 10, 60][-speed];
          stepsPerFrame = (frameCount % skip) ? 0 : 1;
          frameCount += 1;
        } else if (speed > 0) { // speed up by making more steps per frame
          const interval = time - lastDrawTime;
          stepsPerFrame += interval < 20.0 ? 1 : -1;
          stepsPerFrame = Math.max(1, stepsPerFrame);
          stepsPerFrame = Math.min(stepsPerFrame, [1, 2, 4, Infinity][speed])
        }
        
        //>> Main stepwise updater
        for (let i = 0; i < stepsPerFrame; ++i) {
          demo.step();
        }
        
        $("#stepCount").innerText = demo.getStepCount();
        $("#ips").innerText = demo.fps();
      }
      lastDrawTime = time;

      twgl.bindFramebufferInfo(gl);
      demo.draw();
      requestAnimationFrame(render);
    }
}