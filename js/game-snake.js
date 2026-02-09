(async function () {
  const { Timer, SFX, showPreview } = window.AppUtil;
  const DATA = await (await fetch('data/snake.json')).json();

  const $ = s => document.querySelector(s);

  const selCat = $('#snakeCat');
  const selSub = $('#snakeSub');
  const selSpeed = $('#snakeSpeed');

  const canvas = $('#snakeCanvas');
  const ctx = canvas.getContext("2d");

  const qOut = $('#snakeQuestion');
  const tOut = $('#snakeTime');
  const cOut = $('#snakeCorrect');
  const sOut = $('#snakeScore');
  const hOut = $('#snakeHigh');

  const timer = new Timer(tOut);
  const livesOut = $('#snakeLives');
  const qIndexOut = $('#snakeQIndex');

  function fill(sel, items) {
    sel.innerHTML='';
    items.forEach(v=>sel.append(new Option(v,v)));
  }

  fill(selCat, Object.keys(DATA));
  function updateSub(){
    fill(selSub, Object.keys(DATA[selCat.value]||{}));
    loadHigh();
  }
  selCat.addEventListener("change", updateSub);
  selSub.addEventListener("change", loadHigh);
  updateSub();

  function hsKey(){return `highscore:snake:${selCat.value}:${selSub.value}:${selSpeed.value}`;}
  function lbKey(){return `snake:${selCat.value}:${selSub.value}:${selSpeed.value}`;}

  function loadHigh(){
    const v = +(localStorage.getItem(hsKey())||0);
    hOut.textContent=v;
  }

  // ---- GAME STATE
  const SIZE=20, COLS=27, ROWS=21;
  const MAX_WRONG = 5;
  let dir, foods, question, answer, index;
  let score=0, correct=0, running=false, interval;
  let flash = null;
  let snake = [];
  let eatenLetters = []; // persistent answer progress
  let wrongCount = 0;
  let grow = 0; 
  let questionPool = [];
  let totalQuestions = 0;
  let finished = false;

  function speakQuestion(text) {
    if (!window.speechSynthesis) return;
  
    const lang = document.getElementById("ttsLang").value;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 0.9;   // slower for learning
    utter.pitch = 1;
  
    window.speechSynthesis.cancel(); // stop previous
    window.speechSynthesis.speak(utter);
  }

  
  function pickQuestion(){
  
    if(questionPool.length === 0){
      // ALL QUESTIONS DONE
      finished = true;
      finish(); // leaderboard save
      alert("🎉 All questions finished!");
      return;
    }
  
    question = questionPool.pop();
    answer = question.a.toUpperCase();
  
    eatenLetters = [];
    index = 0;
    grow = 0;
    
    // ✅ RESET SNAKE LENGTH EVERY QUESTION
    snake = [{x:13, y:10}]; 
    dir = "RIGHT";
    
    qIndexOut.textContent = `${totalQuestions - questionPool.length}/${totalQuestions}`;

    updateQuestion();
  }

  
  function updateQuestion(){
    qOut.textContent = question.q + " → " +
      answer.slice(0,index) + "_".repeat(answer.length-index);
  }

  function placeFoods(){
    foods=[];
    const correct = answer[index];
    const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let pool=[correct];
    while(pool.length<5){
      let l=alphabet[Math.floor(Math.random()*26)];
      if(!pool.includes(l)) pool.push(l);
    }
    pool.forEach(l=>{
      foods.push({l,x:Math.floor(Math.random()*COLS),y:Math.floor(Math.random()*ROWS)});
    });
  }

  function start(){
    const list = DATA[selCat.value][selSub.value][0].questions;
    questionPool = [...list].sort(()=>Math.random()-0.5);
    totalQuestions = list.length;
    finished = false;
    
    snake = [{x:13,y:10, letter:null}];
    dir="RIGHT";
    score=0; correct=0;
    sOut.textContent=0; cOut.textContent=0;
    wrongCount = 0;
    livesOut.textContent = MAX_WRONG;

    pickQuestion();
    placeFoods();

    let speed = selSpeed.value==="slow"?220: selSpeed.value==="normal"?140:80;
    clearInterval(interval);
    interval=setInterval(loop,speed);

    timer.reset(); timer.start();
    running=true;
  }

  function loop(){
    if(finished) return;

    ctx.fillStyle="#0b1020";
    ctx.fillRect(0,0,canvas.width,canvas.height);

   let head={...snake[0]};
    if(dir==="LEFT") head.x--;
    if(dir==="RIGHT") head.x++;
    if(dir==="UP") head.y--;
    if(dir==="DOWN") head.y++;
    
    head.x=(head.x+COLS)%COLS;
    head.y=(head.y+ROWS)%ROWS;
    snake.unshift(head);
    snake.pop(); // normal move

    // eat letters
    let eaten=false;
    foods.forEach(f=>{
      if(f.x===head.x && f.y===head.y){
     
        if(f.l === answer[index]){
          index++;
          eatenLetters.push(f.l);
          score += 10;
          flash="green";
        
          grow++; // ONLY this, NO snake.push()
     // add new body segment with letter (tail will stay)
            //snake.push({x: head.x, y: head.y, letter: f.l});   
          updateQuestion();
        
          if(index >= answer.length){
            correct++;
            cOut.textContent = correct;
            score += 50;
            SFX.success();
            pickQuestion();
          }
          placeFoods();
        } else {
          wrongCount++;
          livesOut.textContent = MAX_WRONG - wrongCount;
          score = Math.max(0, score-5);
          flash="red";
    
          if(wrongCount >= MAX_WRONG){
            alert("Game Over 😵 Too many wrong letters!");
            finish(); //save leaderboard
            return;
          }
          placeFoods();
        }
      }
    });


    // grow ONLY when correct letter
    if(grow > 0){
      grow--;
      snake.push({...snake[snake.length-1]});
    }
        
    // draw snake
     snake.forEach((s,i)=>{
      ctx.fillStyle = i==0 ? "#22c55e" : "#16a34a";
      ctx.fillRect(s.x*SIZE, s.y*SIZE, SIZE, SIZE);
    
      if(i>0 && eatenLetters[i-1]){
        ctx.fillStyle="white";
        ctx.font="bold 14px monospace";
        ctx.textAlign="center";
        ctx.textBaseline="middle";
        ctx.fillText(eatenLetters[i-1], s.x*SIZE+SIZE/2, s.y*SIZE+SIZE/2);
      }
    });

    if(flash){
      ctx.fillStyle = flash==="green" ? "rgba(0,255,0,0.1)" : "rgba(255,0,0,0.1)";
      ctx.fillRect(0,0,canvas.width,canvas.height);
      flash=null;
    }

    // draw letters
    foods.forEach(f=>{
      ctx.fillStyle="#facc15";
      ctx.fillRect(f.x*SIZE,f.y*SIZE,SIZE,SIZE);
      ctx.fillStyle="#000";
      ctx.fillText(f.l,f.x*SIZE+6,f.y*SIZE+14);
    });

    sOut.textContent=score;
  }

  function finish(){
    running=false;
    clearInterval(interval);
    timer.stop();

    const ms=timer.elapsedMs();
    const prev=+(localStorage.getItem(hsKey())||0);
    const best=Math.max(prev,score);
    localStorage.setItem(hsKey(),best);
    hOut.textContent=best;

    localStorage.setItem(lbKey(), JSON.stringify({
      score, right:correct, ms, date:new Date().toISOString()
    }));
  }

  document.addEventListener("keydown",e=>{
    if(!running) return;
    if(e.key==="ArrowLeft") dir="LEFT";
    if(e.key==="ArrowRight") dir="RIGHT";
    if(e.key==="ArrowUp") dir="UP";
    if(e.key==="ArrowDown") dir="DOWN";
  });

  // ----- MOBILE SWIPE CONTROLS -----
  let touchStartX=0, touchStartY=0;
  
  canvas.addEventListener("touchstart", e=>{
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  });
  
  canvas.addEventListener("touchend", e=>{
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
  
    if(Math.abs(dx) > Math.abs(dy)){
      if(dx > 20) dir = "RIGHT";
      if(dx < -20) dir = "LEFT";
    } else {
      if(dy > 20) dir = "DOWN";
      if(dy < -20) dir = "UP";
    }
  });

  
  $('#snakeStart').addEventListener("click",start);

  $('#snakePreview').addEventListener("click",()=>{
    const list=DATA[selCat.value][selSub.value][0].questions;
    showPreview("Snake Preview", list.map(q=>q.q+" → "+q.a).join("<br>"));
  });

})();
