'use strict';
// Tokens remain in memory. Local saves keep the existing v3 key and migration.
(() => {
  let token='', revision=null, busy=false, mode='local', message='ローカル保存を利用中', config=null, timer=null, blocked=false, generation=0;
  const originalSave=save, originalRender=render;
  const status=()=>{const el=$('save-status');if(el)el.textContent=mode==='local'?(storageOK?'ローカル保存済み':'ローカル保存に失敗'):message;const out=$('cloud-message');if(out)out.textContent=message;};
  const setMessage=text=>{message=text;status();};
  async function api(method='GET',body,session=generation){
    const credential=token;
    const response=await fetch('/api/save',{method,cache:'no-store',headers:{Authorization:'Bearer '+credential,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
    if(session!==generation)throw Error('stale_session');
    if(!response.ok){if(response.status===409){blocked=true;throw Error('別の端末で更新されています。クラウドを読み込むか、保存先をローカルに切り替えてください。');}if(response.status===401){token='';blocked=true;throw Error('Googleログインの有効期限が切れました。再ログインしてください。');}throw Error('クラウド保存に接続できません。ローカルの控えを保持しています。');}
    const result=await response.json();if(session!==generation)throw Error('stale_session');return result;
  }
  async function upload(){
    if(busy||!token||mode!=='cloud'||blocked||revision===null)return;
    busy=true;clearTimeout(timer);timer=null;setMessage('クラウドへ保存中…');
    const snapshot=JSON.stringify(s),session=generation;
    try{const result=await api('PUT',{save:JSON.parse(snapshot),revision},session);revision=result.revision;setMessage(storageOK?'クラウド保存済み（端末にも控えあり）':'クラウド保存済み・端末の控えは保存できません');if(JSON.stringify(s)!==snapshot)timer=setTimeout(upload,5000);}
    catch(e){if(session===generation){blocked=true;setMessage(e.message+' 「再接続・保存」を押して再試行できます。');}}
    finally{busy=false;}
  }
  save=function(){originalSave();if(mode==='cloud'&&token&&!blocked&&revision!==null&&!timer&&!busy)timer=setTimeout(()=>{timer=null;upload();},5000);};
  render=function(){originalRender();status();};
  function local(){generation++;mode='local';blocked=true;revision=null;clearTimeout(timer);timer=null;setMessage('ローカル保存を利用中');originalSave();}
  async function connect(){
    if(busy||!token)return;busy=true;clearTimeout(timer);timer=null;blocked=true;stopAll();const session=generation;
    try{
      const remote=await api('GET',undefined,session);
      if(remote.save!==null){
        if(!validSave(remote.save))throw Error('クラウドの保存形式を読み込めません。現在の冒険を保持しました。');
        const load=confirm('このGoogleアカウントにクラウド保存があります。OK：クラウドを読み込む／キャンセル：現在の冒険を送信するか次に確認');
        if(load){
          // A failed backup must prevent replacing the active local adventure.
          localStorage.setItem(KEY+'-before-cloud',JSON.stringify(s));
          const next=structuredClone(remote.save);next.autoExpedition=false;
          localStorage.setItem(KEY,JSON.stringify(next));s=next;
        }else if(!confirm('現在の冒険でクラウド保存を上書きしますか？')){local();return;}
      }else if(!confirm('このGoogleアカウントに現在の冒険をクラウド保存しますか？')){local();return;}
      revision=remote.revision;mode='cloud';blocked=false;render();
    }catch(e){if(session===generation)setMessage(e.message||'接続に失敗しました。現在の冒険を保持しました。');}
    finally{busy=false;}
    if(session===generation&&mode==='cloud'&&!blocked)await upload();
  }
  async function login(){
    const holder=$('google-signin');holder.textContent='Googleログインを準備中…';
    try{
      if(location.protocol==='file:')throw Error('クラウド保存はHTTPSで公開したゲームから利用できます。ローカル保存はこのまま使えます。');
      if(!config){const response=await fetch('/api/config',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('このゲームではクラウド保存の準備ができていません。ローカル保存をご利用ください。');config=await response.json();}
      if(!config.cloudEnabled||!config.googleClientId)throw Error('Google認証とクラウド保存は未設定です。');
      if(!window.google?.accounts?.id)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('Googleログインを読み込めません。'));};document.head.appendChild(script);});
      holder.textContent='';
      google.accounts.id.initialize({client_id:config.googleClientId,auto_select:false,callback:result=>{local();token=result.credential;setMessage('Googleログイン済み。クラウドへの接続を確認してください。');connect();}});
      google.accounts.id.renderButton(holder,{theme:'outline',size:'large',text:'signin_with'});
    }catch(e){holder.textContent='';setMessage(e.message);}
  }
  function init(){
    document.addEventListener('keydown',event=>{if($('save-dialog').open&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(event.key)&&!['INPUT','TEXTAREA'].includes(event.target.tagName))event.stopImmediatePropagation();},true);
    $('save-settings').onclick=()=>{stopAll();render();$('save-dialog').showModal();status();};
    $('save-close').onclick=()=>$('save-dialog').close();
    $('save-local').onclick=()=>{local();};
    $('save-google').onclick=login;
    $('save-connect').onclick=()=>{if(!token)return setMessage('先にGoogleログインしてください。');connect();};
    $('save-signout').onclick=()=>{if(busy)return;local();token='';window.google?.accounts?.id.disableAutoSelect();$('google-signin').textContent='';setMessage('ログアウトしました。ローカル保存を利用中');};
    // A reset is local until the player deliberately reconnects and confirms upload.
    const reset=$('reset').onclick;$('reset').onclick=()=>{if(busy)return;local();reset();};
    status();
  }
  const originalBoot=boot;boot=function(){originalBoot();init();};
})();
