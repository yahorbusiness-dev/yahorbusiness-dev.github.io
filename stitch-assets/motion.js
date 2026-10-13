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
