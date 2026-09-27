const labels = {name:'名称',path:'路径',icon:'图标类名',class:'颜色样式',text:'文字',link:'链接',shields:'徽标图片',message:'提示语',title:'标题',class_name:'分类名称',class_desc:'分类说明',descr:'描述',avatar:'头像'};
export function renderList(container, schema, values, upload) {
  const rows=document.createElement('div');container.append(rows);
  const changed=()=>container.dispatchEvent(new Event('input',{bubbles:true}));
  function add(data={}) {
    const row=document.createElement('div');row.className='structured-row';row.dataset.rowId=data._rowId ?? '';
    const fields=document.createElement('div');fields.className='list-fields';row.append(fields);
    for(const [key,type] of Object.entries(schema.fields)) {
      const label=document.createElement('label');label.textContent=labels[key]||key;
      const input=document.createElement(type==='class'?'select':'input');input.dataset.field=key;
      if(type==='class')for(const [value,text] of [['blue','蓝色'],['red','红色'],['green','绿色']]){const option=document.createElement('option');option.value=value;option.textContent=text;input.append(option);}
      input.value=data[key]??(type==='class'?'blue':'');
      if(type==='icon')input.placeholder='如 anzhiyu-icon-link';
      label.append(input);fields.append(label);
      if(type==='image'){const button=document.createElement('button');button.type='button';button.textContent='上传图片';button.onclick=()=>upload(url=>{input.value=url;changed();});label.append(button);}
    }
    let children;
    if(schema.children){const nested=document.createElement('div');nested.className='nested-list';row.append(nested);children=renderList(nested,schema.children,data[schema.children.key]||[],upload);}
    row.collect=()=>{const result=Object.fromEntries([...fields.querySelectorAll('[data-field]')].map(input=>[input.dataset.field,input.value.trim()]));if(row.dataset.rowId)result._rowId=row.dataset.rowId;if(children)result[schema.children.key]=children();return result;};
    const actions=document.createElement('div');actions.className='row-actions';row.append(actions);
    for(const [action,text] of [['up','上移'],['down','下移'],['remove','移除']]){
      const button=document.createElement('button');button.type='button';button.dataset.action=action;button.textContent=text;
      button.onclick=()=>{if(action==='remove')row.remove();else if(action==='up'&&row.previousElementSibling)rows.insertBefore(row,row.previousElementSibling);else if(action==='down'&&row.nextElementSibling)rows.insertBefore(row.nextElementSibling,row);changed();};actions.append(button);
    }
    rows.append(row);
  }
  values.forEach(add);
  const button=document.createElement('button');button.type='button';button.textContent=schema.children?'添加分组':'添加条目';button.onclick=()=>{add();changed();};container.append(button);
  return ()=>[...rows.children].map(row=>row.collect());
}
