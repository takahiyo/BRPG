from pathlib import Path
p=Path('game.js');s=p.read_text(encoding='utf-8-sig')
s=s.replace("if(!arr(v.active)","if(v.roster.some(h=>(h.sp!==undefined&&!num(h.sp))||(h.learned!==undefined&&(!arr(h.learned)||!h.learned.every(id=>DATA.skills[id])))||(h.jobHistory!==undefined&&(!arr(h.jobHistory)||!h.jobHistory.every(id=>DATA.jobs[id])))))return false;\n if(v.reserve&&(!['percent','absolute'].includes(v.reserve.mode)||!['life','mana','sp'].every(k=>num(v.reserve[k]))))return false;\n if(!arr(v.active)")
s=s.replace('elementOverride=null){','elementOverride=null,spend=true){').replace('h.sp=Math.max(0,(h.sp??maxSP(h))-1);if(g?.dur','if(spend)h.sp=Math.max(0,(h.sp??maxSP(h))-1);if(g?.dur').replace("heroAttack(h,a,k.power||1,k.element||'physical')","heroAttack(h,a,k.power||1,k.element||'physical',false)")
s=s.replace('if(legacy)v=migrateV2(v);','if(legacy){try{v=migrateV2(v);}catch{v=null;}}')
p.write_text(s,encoding='utf-8')
p=Path('screens.js');s=p.read_text(encoding='utf-8-sig');s=s.replace("['hp','最大HP'],['mp','最大MP']","['hp','最大LIFE'],['mp','最大MANA']")
a=s.index('<p class="muted">Lv.1：');b=s.index('<p class="muted">能力値には',a)
s=s[:a]+'''<p>LIFE上限：職業基礎 + 9×(Lv−1) / MANA上限：職業基礎 + 4×(Lv−1)<br>攻撃：丸め(STR×1.05) + Lv−1 + 武器 + ⌊DEX/12⌋<br>魔力：INT + Lv−1 + 宝石武器 / 防御：職業基礎 + Lv−1 + 防具・付呪<br>速度：AGI / SP上限：20 + VIT×2</p>'''+s[b:]
p.write_text(s,encoding='utf-8')
p=Path('systems.js');s=p.read_text(encoding='utf-8-sig');s=s.replace("return owner&&!canEquip(owner,g)?0:oldGearValue(g);","return owner&&!canEquip(owner,g)?0:Math.round(oldGearValue(g)*(owner&&g.method==='magic'?1+Math.max(0,attributes(owner).WIZ-10)*.01:1));")
p.write_text(s,encoding='utf-8')
