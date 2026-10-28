// Shared motion for UngEkonom pages. Pair with motion.css.
//
// Usage:
//   <div data-reveal>…</div>                 fade + slide up when scrolled into view
//   <div data-reveal="left|right|fade|zoom">  other directions
//   <div data-reveal-stagger="120">…</div>    children with data-reveal get 120ms steps of delay
//   <span data-count>70+</span>              counts up to the number in the text, keeps prefix/suffix
//   class="hover-lift" / class="press"       hover and press feedback (CSS only)
(function(){
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce||!('IntersectionObserver' in window))return;
  document.documentElement.classList.add('motion-ok');

  function init(){
    document.querySelectorAll('[data-reveal-stagger]').forEach(function(group){
      var step=parseInt(group.getAttribute('data-reveal-stagger'),10)||100;
      group.querySelectorAll('[data-reveal]').forEach(function(el,i){
        el.style.setProperty('--reveal-delay',(i*step/1000)+'s');
      });
    });

    var revealIO=new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(!e.isIntersecting)return;
        e.target.classList.add('is-revealed');
        revealIO.unobserve(e.target);
      });
    },{threshold:0.15,rootMargin:'0px 0px -8% 0px'});
    document.querySelectorAll('[data-reveal]').forEach(function(el){revealIO.observe(el)});

    var countIO=new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(!e.isIntersecting)return;
        countUp(e.target);
        countIO.unobserve(e.target);
      });
    },{threshold:0.6});
    document.querySelectorAll('[data-count]').forEach(function(el){countIO.observe(el)});
  }

  function countUp(el){
    var m=el.textContent.match(/^(\D*)(\d(?:[\d\s]*\d)?)(.*)$/);
    if(!m)return;
    var prefix=m[1],suffix=m[3],target=parseInt(m[2].replace(/\s/g,''),10);
    if(!target)return;
    var dur=parseInt(el.getAttribute('data-count'),10)||1200,start=null;
    function frame(t){
      if(start===null)start=t;
      var p=Math.min(1,(t-start)/dur),eased=1-Math.pow(1-p,3);
      el.textContent=prefix+Math.round(target*eased).toLocaleString('sv-SE')+suffix;
      if(p<1)requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();

// "Till toppen": a button that slides in from the right once the page is scrolled down.
(function(){
  function init(){
    if(document.querySelector('.to-top'))return;
    var btn=document.createElement('button');
    btn.type='button';btn.className='to-top';btn.setAttribute('aria-label','Till toppen');
    btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg><span>Till toppen</span>';
    document.body.appendChild(btn);
    var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Custom eased scroll so it is slower than the browser's built-in smooth scroll.
    var anim=null;
    function stop(){if(anim){cancelAnimationFrame(anim);anim=null}}
    ['wheel','touchstart','keydown'].forEach(function(ev){window.addEventListener(ev,stop,{passive:true})});
    btn.addEventListener('click',function(){
      stop();
      var from=window.scrollY;
      if(reduce||from<=0){window.scrollTo(0,0);return}
      var dur=Math.min(1800,Math.max(900,from*0.35)),start=null;
      function frame(t){
        if(start===null)start=t;
        var p=Math.min(1,(t-start)/dur);
        var e=p<0.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
        window.scrollTo(0,Math.round(from*(1-e)));
        anim=p<1?requestAnimationFrame(frame):null;
      }
      anim=requestAnimationFrame(frame);
    });
    var ticking=false;
    function update(){
      ticking=false;
      btn.classList.toggle('is-visible',window.scrollY>window.innerHeight*0.8);
    }
    window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(update)}},{passive:true});
    update();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();
