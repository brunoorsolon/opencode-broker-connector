// Minimal VT screen replay for the isolated 140x32 official-TUI PTY fixture.
// Tracks display cells rather than concatenating differential terminal output.
export class TerminalScreen {
 constructor(columns=140,rows=32){this.columns=columns;this.rows=rows;this.cells=Array.from({length:rows},()=>Array(columns).fill(' '));this.x=0;this.y=0;this.pending='';this.last=' ';this.saved=[0,0];}
 write(input){
  let text=this.pending+input;this.pending='';
  const put=char=>{if(this.x>=this.columns){this.x=0;this.y++;}if(this.y>=this.rows){this.cells.shift();this.cells.push(Array(this.columns).fill(' '));this.y=this.rows-1;}this.cells[this.y][this.x++]=char;this.last=char;};
  for(let i=0;i<text.length;){
   const c=text[i];
   if(c==='\x1b'){
    if(i+1>=text.length){this.pending=text.slice(i);break;}
    if(text[i+1]==='['){
     const match=/^\x1b\[([0-?]*)([ -/]*)([@-~])/.exec(text.slice(i));
     if(!match){this.pending=text.slice(i);break;}
     const raw=match[1],p=raw.replace(/^[?>!]/,'').split(';').map(x=>Number(x)||0),n=p[0]||1,op=match[3];
     if(op==='H'||op==='f'){this.y=(p[0]||1)-1;this.x=(p[1]||1)-1;}
     else if(op==='A')this.y-=n;else if(op==='B')this.y+=n;else if(op==='C')this.x+=n;else if(op==='D')this.x-=n;
     else if(op==='G')this.x=n-1;else if(op==='d')this.y=n-1;
     else if(op==='E'){this.y+=n;this.x=0;}else if(op==='F'){this.y-=n;this.x=0;}
     else if(op==='b')for(let k=0;k<n;k++)put(this.last);
     else if(op==='K'){const start=p[0]===1||p[0]===2?0:this.x,end=p[0]===0?this.columns:this.x+1;this.cells[this.y].fill(' ',start,p[0]===2?this.columns:end);}
     else if(op==='J'){for(let row=0;row<this.rows;row++)for(let col=0;col<this.columns;col++)if(p[0]===2||p[0]===3||(p[0]===0&&(row>this.y||row===this.y&&col>=this.x))||(p[0]===1&&(row<this.y||row===this.y&&col<=this.x)))this.cells[row][col]=' ';}
     else if(op==='s')this.saved=[this.x,this.y];else if(op==='u')[this.x,this.y]=this.saved;
     this.x=Math.max(0,Math.min(this.columns,this.x));this.y=Math.max(0,Math.min(this.rows-1,this.y));i+=match[0].length;continue;
    }
    if(text[i+1]===']'||text[i+1]==='P'||text[i+1]==='_'){
     const end=/\x07|\x1b\\/.exec(text.slice(i+2));if(!end){this.pending=text.slice(i);break;}i+=2+end.index+end[0].length;continue;
    }
    i+=2;continue;
   }
   if(c==='\r')this.x=0;else if(c==='\n'){this.y++;if(this.y>=this.rows){this.cells.shift();this.cells.push(Array(this.columns).fill(' '));this.y=this.rows-1;}}
   else if(c==='\b')this.x=Math.max(0,this.x-1);else if(c==='\t')this.x=Math.min(this.columns,Math.ceil((this.x+1)/8)*8);
   else if(c>=' '&&c!=='\x7f')put(c);
   i++;
  }
 }
 text(){return this.cells.map(row=>row.join('')).join('\n');}
}
