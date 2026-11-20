'use strict';

(() => {
  const desktop = window.souzDesktop;
  if (desktop?.role !== 'control') return;

  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'btn';
  launcher.id = 'updatesLink';
  launcher.textContent = 'Atualizações';
  launcher.setAttribute('aria-haspopup','dialog');
  document.getElementById('updatesLink').replaceWith(launcher);

  const panel = document.createElement('dialog');
  panel.className = 'about bridge-dialog';
  panel.setAttribute('aria-labelledby','updateTitle');
  panel.innerHTML = '<h2 id="updateTitle">Atualizações</h2>' +
    '<dl class="about-card"><div><dt>Instalada</dt><dd id="updateInstalled"></dd></div>' +
    '<div><dt>Disponível</dt><dd id="updateAvailable"></dd></div></dl>' +
    '<p class="note" id="updateMessage" role="status"></p>' +
    '<progress id="updateProgress" aria-label="Progresso do download" max="100" hidden></progress>' +
    '<p class="note" id="updateBlock" hidden></p>' +
    '<div class="row" style="flex-wrap:wrap;margin-top:14px">' +
    '<button class="btn" type="button" data-action="check">Verificar</button>' +
    '<button class="btn" type="button" data-action="download">Baixar</button>' +
    '<button class="btn pri" type="button" data-action="install">Instalar e reiniciar</button>' +
    '<form method="dialog" style="margin:0"><button class="btn" type="submit">Depois</button></form></div>';
  document.body.append(panel);

  const ui = id => document.getElementById(id);
  const buttons = Object.fromEntries(Array.from(panel.querySelectorAll('[data-action]'),
    button => [button.dataset.action,button]));

  function update(state) {
    if (!state) return;
    launcher.textContent = state.available ? 'Atualizações •' : 'Atualizações';
    ui('updateInstalled').textContent = state.installed;
    ui('updateAvailable').textContent = state.available ?? '—';
    ui('updateMessage').textContent = state.message;
    const progress = ui('updateProgress');
    progress.hidden = state.phase !== 'downloading';
    progress.value = state.progress ?? 0;
    const block = ui('updateBlock');
    block.hidden = state.phase !== 'downloaded' || !state.block;
    block.textContent = state.block;
    buttons.check.disabled = ['checking','downloading','downloaded','installing'].includes(state.phase);
    buttons.download.disabled = state.phase !== 'available';
    buttons.install.disabled = state.phase !== 'downloaded' || Boolean(state.block);
  }

  async function command(action) {
    try {
      update(await desktop.updates(action));
    } catch (error) {
      ui('updateMessage').textContent = error.message;
    }
  }

  launcher.onclick = () => { panel.showModal(); command('state'); };
  panel.addEventListener('close',()=>launcher.focus({preventScroll:true}));
  panel.addEventListener('keydown',event=>event.stopPropagation());
  Object.entries(buttons).forEach(([action,button])=>{button.onclick=()=>command(action);});
  desktop.onUpdate(update);
  command('state');
})();
