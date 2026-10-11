/** Edit complete assignments without normalizing unrelated comments or bytes. */
export function patchEnvironmentText(original,updates,{quoteAll=false}={}){
  if(typeof original!=='string'||!updates||typeof updates!=='object'||Array.isArray(updates))throw Error('Invalid environment assignments');
  if(Object.keys(updates).length===0)return original;
  const lines=original.match(/[^\n]*\n|[^\n]+$/g)||[],removed=new Set();
  for(let i=0;i<lines.length;i++){
    const match=lines[i].match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)/);if(!match)continue;
    const start=i,value=match[2].trim(),quote=['"',"'",'`'].includes(value[0])?value[0]:null;
    if(quote){
      let joined=value;
      const closed=()=>{for(let n=1;n<joined.length;n++)if(joined[n]===quote){let escapes=0;for(let p=n-1;p>=0&&joined[p]==='\\';p--)escapes++;if(escapes%2===0)return true;}return false;};
      while(!closed()&&i+1<lines.length)joined+=lines[++i];
      if(!closed())throw Error('Unclosed environment value');
    }
    if(Object.hasOwn(updates,match[1]))for(let n=start;n<=i;n++)removed.add(n);
  }
  let result=lines.filter((_,index)=>!removed.has(index)).join('');
  if(result&&!result.endsWith('\n'))result+='\n';
  for(const [key,value] of Object.entries(updates)){
    if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)||typeof value!=='string'||/[\r\n\0]/.test(value))throw Error('Invalid environment assignments');
    const literal=!quoteAll&&/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)?value:JSON.stringify(value);
    result+=`${key}=${literal}\n`;
  }
  return result;
}
