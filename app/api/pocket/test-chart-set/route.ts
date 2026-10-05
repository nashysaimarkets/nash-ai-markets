import { NextResponse } from "next/server";
import { inflateSync } from "node:zlib";
import { scanDevicePixels, type DeviceLocalScan } from "../../../pocket-next/device-geometry";

export const runtime = "nodejs";
export const maxDuration = 60;


const CASES = [
  { id:"hs-btc", expected:"HEAD & SHOULDERS", url:"https://s3.tradingview.com/snapshots/f/fzD3jQZO.png" },
  { id:"ihs-btc", expected:"INVERSE H&S", url:"https://s3.tradingview.com/snapshots/u/UFenqU3j.png" },
  { id:"double-top-amzn", expected:"DOUBLE TOP", url:"https://miro.medium.com/v2/resize%3Afit%3A3094/1%2Ap1lx4gYYTCuucs82oPdsGQ.png" },
  { id:"bear-flag-usdjpy", expected:"BEAR FLAG", url:"https://cms.naga.com/bear_flag_pattern_b57453de92.png" },
  { id:"bear-flag-btc", expected:"BEAR FLAG", url:"https://cloudfront-us-east-1.images.arcpublishing.com/coindesk/4EXWGCIRQJHL5KVEFDQHB5Z3XY.png" },
  { id:"ascending-triangle", expected:"ASCENDING TRIANGLE", url:"https://s3.eu-west-1.amazonaws.com/cms.naga.com/ascending_triangle_8d89134892.png" },
  { id:"ascending-triangle-fincables", expected:"TRIANGLE", url:"https://s3.tradingview.com/snapshots/q/QDCtJbdz.png" },
  { id:"rising-wedge", expected:"RISING WEDGE", url:"https://blueberrymarkets.com/media/10lhmzmj/unnamed.png" },
  { id:"range-stock", expected:"RECTANGLE / RANGE", url:"https://cms.naga.com/image_3bb66d0bfe.png" },
  { id:"range-eth", expected:"RECTANGLE / RANGE", url:"https://primexbt.com/media/2025/06/ETHUSDT_2025-06-16_07-44-25_cac52.png" },
  { id:"fake-breakout", expected:"NO CLEAN PATTERN", url:"https://s3.tradingview.com/o/OamyAqgr_big.png" },
  { id:"sp500-uptrend", expected:"NO CLEAN PATTERN", url:"https://cdn.prod.website-files.com/67929b1ba94c8a3c19e0de70/682b5e7ee93ca89781a87458_68052b584c33f7138b689ab7_tradingview.png" },
  { id:"gold-levels", expected:"NO CLEAN PATTERN", url:"https://s3.tradingview.com/snapshots/s/s7h8BepM.png" },
  { id:"brent-levels", expected:"NO CLEAN PATTERN", url:"https://d1-invdn-com.akamaized.net/content/piccee72e0c5679dba090cf0eb8c57b78b4.png" },
  { id:"ihs-fcel", expected:"INVERSE H&S", url:"https://s3.tradingview.com/j/Jm7wpOeW_mid.png" },
  { id:"btc-bull-flag", expected:"BULL FLAG", url:"https://cdn.sanity.io/images/s3y3vcno/production/a8dc6b10a6b35add73f41533c63b4176b74f213a-1007x748.png?auto=format" },
  { id:"eurusd-channel", expected:"TREND CHANNEL", url:"https://tradeciety.com/hs-fs/hubfs/Trendline%20Channel%20Upward.png?height=4635&name=Trendline+Channel+Upward.png&width=8994" },
  { id:"btc-double-top-coindesk", expected:"DOUBLE TOP", url:"https://cdn.sanity.io/images/s3y3vcno/production/36ca2959d23639eb0a9c522e967ef977e9a2fb2b-1258x847.png?auto=format" },
  { id:"range-axi", expected:"RECTANGLE / RANGE", url:"https://d2tpnh780x5es.cloudfront.net/rebrand-prod/axnlzyhk/range-trading.png" },
  { id:"btc-rising-wedge-tv", expected:"RISING WEDGE", url:"https://s3.tradingview.com/j/JUlnUzQx_mid.png" },
  { id:"btc-triangle-breakout", expected:"TRIANGLE", url:"https://cdn.sanity.io/images/s3y3vcno/production/84960f4d7992f4f9adafb73d6bfe00803fcdb405-2010x1214.png?auto=format" },
  { id:"msft-head-shoulders", expected:"HEAD & SHOULDERS", url:"https://miro.medium.com/v2/resize%3Afit%3A1200/1%2Ac1zWUXNfUopaZ8Wl-cySGQ.png" },
  { id:"pvr-cup-handle", expected:"CUP & HANDLE", url:"https://s3.tradingview.com/i/IoH3xUIP.png" },
  { id:"btc-double-bottom", expected:"DOUBLE BOTTOM", url:"https://s3.tradingview.com/y/YRTSbmTz_mid.png" },
  { id:"eurusd-straight-downtrend", expected:"NO CLEAN PATTERN", url:"https://s3.tradingview.com/q/QXo92Wjj_mid.png?v=1778496476" },
  { id:"ftmo-falling-wedge", expected:"FALLING WEDGE", url:"https://ftmo-frontend-prod.storage.googleapis.com/wp-content/uploads/2023/10/04161105/TradingView-All-Chart-Patterns.png" },
  { id:"utx-double-bottom", expected:"DOUBLE BOTTOM", url:"https://www.tradercampus.de/sites/default/files/dubbele_bodem.png" },
  { id:"idx-double-bottom", expected:"DOUBLE BOTTOM", url:"https://img.idxchannel.com/images/idx/2024/11/07/double-buttom-pattern.png" },
  { id:"upstox-double-top", expected:"DOUBLE TOP", url:"https://europe1.discourse-cdn.com/flex017/uploads/upstox1/original/2X/f/f9ce0213237f0e308ec03217ab841562728438d4.png" },
  { id:"tradingfuel-inverse-hs", expected:"INVERSE H&S", url:"https://www.tradingfuel.com/wp-content/uploads/2020/06/Inverse-Head-and-shoulder-1024x764.png" },
  { id:"top1-rising-wedge", expected:"RISING WEDGE", url:"https://images.top1market.com/images/ueditor/php/upload/image/20220328/1648458815661470.png" },
  { id:"coinsect-desc-triangle", expected:"DESCENDING TRIANGLE", url:"https://d1085v6s0hknp1.cloudfront.net/boards/free_board/210f97df-3041-48ec-8b34-830caa6411fd_image.png" },
  { id:"b2broker-bull-flag", expected:"BULL FLAG", url:"https://media.b2broker.com/app/uploads/2024/12/bullish-flag-pattern-1536x1100.png" },
  { id:"cipla-cup-handle", expected:"CUP & HANDLE", url:"https://www.sharetradingcampus.com/storage/204/60c24c236adf5_CIPLA-CUP-%26-HANDLE.png" },
  { id:"capital-break-retest", expected:"BREAKOUT & RETEST", url:"https://img.capital.com/articles/articleimg_b223db2e9639c691ad785f240f43f80a59ca2e99.png" },
  { id:"capital-ihs-clean", expected:"INVERSE H&S", url:"https://img.capital.com/docs/image10.png" },
  { id:"osl-falling-wedge", expected:"FALLING WEDGE", url:"https://images.ctfassets.net/s9n78lc7gxyk/3YKSP0myPsxaox3ZSvSMmm/f03f061fa8799c607dec262566b5342b/what-is-falling-wedge-pattern-cover.png" },
  { id:"zenledger-rising-wedge", expected:"RISING WEDGE", url:"https://uploads-ssl.webflow.com/5f9a1900790900e2b7f25ba1/5ff3beb6338bc82c47eb8b55_rising-wedge.png" },
  { id:"nicepng-double-top", expected:"DOUBLE TOP", url:"https://www.nicepng.com/png/detail/187-1870455_double-top-chart-pattern-double-top-candlestick-pattern.png" },
  { id:"nicepng-inverse-hs", expected:"INVERSE H&S", url:"https://www.nicepng.com/png/detail/432-4320678_simple-inverted-head-and-shoulders-candlestick-pattern-diagram.png" },
  { id:"vecomda-break-retest", expected:"BREAKOUT & RETEST", url:"https://tstvmediaprod.blob.core.windows.net/posts/kien-thuc/chien-luoc-theo-xu-huong/chien-luoc-theo-xu-huong-7-breackout.png" }

] as const;

async function fetchImage(url:string){
  const r = await fetch(url, { headers: { "user-agent":"Mozilla/5.0 PocketBullseyeTest/1.0", "accept":"image/png,image/*;q=0.8" }, cache:"no-store" });
  if(!r.ok) throw new Error("HTTP "+String(r.status));
  const type=r.headers.get("content-type")||"";
  const buffer=Buffer.from(await r.arrayBuffer());
  if(!type.includes("png") && !buffer.subarray(1,4).equals(Buffer.from("PNG"))) throw new Error("NOT_PNG "+type);
  return buffer;
}

function paeth(a:number,b:number,c:number){
  const p=a+b-c, pa=Math.abs(p-a), pb=Math.abs(p-b), pc=Math.abs(p-c);
  return pa<=pb&&pa<=pc?a:pb<=pc?b:c;
}

function decodePng(buffer:Buffer){
  const sig=Buffer.from([137,80,78,71,13,10,26,10]);
  if(buffer.length<24||!buffer.subarray(0,8).equals(sig)) throw new Error("Invalid PNG");
  let pos=8, width=0, height=0, bitDepth=0, colorType=-1, interlace=0;
  let palette:Buffer|null=null, transparency:Buffer|null=null;
  const idat:Buffer[]=[];
  while(pos+12<=buffer.length){
    const len=buffer.readUInt32BE(pos), type=buffer.toString("ascii",pos+4,pos+8);
    const data=buffer.subarray(pos+8,pos+8+len);
    pos+=12+len;
    if(type==="IHDR"){
      width=data.readUInt32BE(0); height=data.readUInt32BE(4);
      bitDepth=data[8]; colorType=data[9]; interlace=data[12];
    } else if(type==="PLTE") palette=Buffer.from(data);
    else if(type==="tRNS") transparency=Buffer.from(data);
    else if(type==="IDAT") idat.push(Buffer.from(data));
    else if(type==="IEND") break;
  }
  if(!width||!height||bitDepth!==8||interlace!==0) throw new Error("Unsupported PNG layout");
  const bpp=colorType===6?4:colorType===2?3:colorType===4?2:colorType===0?1:colorType===3?1:0;
  if(!bpp) throw new Error("Unsupported PNG colour type "+colorType);
  const rowBytes=width*bpp;
  const packed=inflateSync(Buffer.concat(idat));
  const raw=Buffer.alloc(rowBytes*height);
  let src=0;
  for(let y=0;y<height;y++){
    const filter=packed[src++];
    const row=y*rowBytes, prev=(y-1)*rowBytes;
    for(let x=0;x<rowBytes;x++){
      const value=packed[src++], left=x>=bpp?raw[row+x-bpp]:0, up=y?raw[prev+x]:0, upLeft=y&&x>=bpp?raw[prev+x-bpp]:0;
      raw[row+x]=(value+(filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):filter===4?paeth(left,up,upLeft):0))&255;
    }
  }
  const rgb=Buffer.alloc(width*height*3);
  for(let i=0;i<width*height;i++){
    const s=i*bpp, d=i*3;
    if(colorType===6||colorType===2){ rgb[d]=raw[s]; rgb[d+1]=raw[s+1]; rgb[d+2]=raw[s+2]; }
    else if(colorType===4||colorType===0){ rgb[d]=rgb[d+1]=rgb[d+2]=raw[s]; }
    else {
      const pi=raw[s]*3;
      rgb[d]=palette?.[pi]??0; rgb[d+1]=palette?.[pi+1]??0; rgb[d+2]=palette?.[pi+2]??0;
      void transparency;
    }
  }
  return {width,height,rgb};
}

function resizeRgb(decoded:{width:number;height:number;rgb:Buffer},maxWidth=420){
  const width=Math.min(maxWidth,decoded.width);
  const height=Math.max(180,Math.round(decoded.height*width/decoded.width));
  const data=Buffer.alloc(width*height*3);
  for(let y=0;y<height;y++){
    const sy=Math.min(decoded.height-1,Math.floor(y*decoded.height/height));
    for(let x=0;x<width;x++){
      const sx=Math.min(decoded.width-1,Math.floor(x*decoded.width/width));
      const s=(sy*decoded.width+sx)*3,d=(y*width+x)*3;
      data[d]=decoded.rgb[s];data[d+1]=decoded.rgb[s+1];data[d+2]=decoded.rgb[s+2];
    }
  }
  return {data,width,height,channels:3};
}

async function scan(buffer:Buffer,maxWidth=420,debug=false,rowMaskFraction?:number,patternRadiusOverride?:number,neutralContrastOverride?:number):Promise<DeviceLocalScan>{
  const {data,width,height,channels}=resizeRgb(decodePng(buffer),maxWidth);
  return scanDevicePixels({pixels:data,width,height,channels,debug,rowMaskFraction,patternRadiusOverride,neutralContrastOverride});
}

function addBrokerChrome(frame:{data:Buffer;width:number;height:number;channels:number}){
  const topPad=Math.max(46,Math.round(frame.height*.11)), bottomPad=Math.max(34,Math.round(frame.height*.08));
  const width=frame.width, height=frame.height+topPad+bottomPad, data=Buffer.alloc(width*height*3,248);
  for(let y=0;y<frame.height;y++) frame.data.copy(data,((y+topPad)*width)*3,y*width*3,(y+1)*width*3);
  const rect=(x0:number,y0:number,x1:number,y1:number,r:number,g:number,b:number)=>{
    for(let y=Math.max(0,y0);y<Math.min(height,y1);y++) for(let x=Math.max(0,x0);x<Math.min(width,x1);x++){
      const i=(y*width+x)*3;data[i]=r;data[i+1]=g;data[i+2]=b;
    }
  };
  // Grey quote boxes plus tiny red/green/blue controls deliberately mimic broker chrome.
  rect(Math.round(width*.55),8,Math.round(width*.76),topPad-8,232,232,232);
  rect(Math.round(width*.76),8,Math.round(width*.97),topPad-8,232,232,232);
  rect(Math.round(width*.08),topPad+frame.height+6,Math.round(width*.17),height-6,47,136,207);
  rect(Math.round(width*.2),topPad+frame.height+6,Math.round(width*.29),height-6,37,168,96);
  rect(Math.round(width*.32),topPad+frame.height+6,Math.round(width*.41),height-6,214,74,69);
  return {data,width,height,channels:3};
}

function addSideChrome(frame:{data:Buffer;width:number;height:number;channels:number}){
  const leftPad=Math.max(34,Math.round(frame.width*.09));
  const rightPad=Math.max(50,Math.round(frame.width*.13));
  const width=frame.width+leftPad+rightPad, height=frame.height;
  const data=Buffer.alloc(width*height*3,246);
  for(let y=0;y<frame.height;y++){
    for(let x=0;x<frame.width;x++){
      const s=(y*frame.width+x)*3,d=(y*width+x+leftPad)*3;
      data[d]=frame.data[s];data[d+1]=frame.data[s+1];data[d+2]=frame.data[s+2];
    }
  }
  const rect=(x0:number,y0:number,x1:number,y1:number,r:number,g:number,b:number)=>{
    for(let y=Math.max(0,y0);y<Math.min(height,y1);y++) for(let x=Math.max(0,x0);x<Math.min(width,x1);x++){
      const i=(y*width+x)*3;data[i]=r;data[i+1]=g;data[i+2]=b;
    }
  };
  rect(4,Math.round(height*.12),leftPad-5,Math.round(height*.22),35,128,202);
  rect(4,Math.round(height*.28),leftPad-5,Math.round(height*.38),38,167,97);
  rect(4,Math.round(height*.44),leftPad-5,Math.round(height*.54),214,73,68);
  for(let y=Math.round(height*.12);y<Math.round(height*.88);y+=Math.max(16,Math.round(height*.07))){
    rect(width-rightPad+6,y,width-6,y+2,96,96,96);
  }
  return {data,width,height,channels:3};
}


async function scanRobust(buffer:Buffer,rowMaskFraction?:number,patternRadiusOverride?:number,neutralContrastOverride?:number){
  const decoded=decodePng(buffer);
  const base=resizeRgb(decoded,420), small=resizeRgb(decoded,300), tiny=resizeRgb(decoded,220);
  const chrome=addBrokerChrome(base), side=addSideChrome(base);
  const scan=(frame:{data:Buffer;width:number;height:number;channels:number})=>scanDevicePixels({
    pixels:frame.data,width:frame.width,height:frame.height,channels:3,rowMaskFraction,patternRadiusOverride,neutralContrastOverride
  });
  return {base:scan(base),small:scan(small),tiny:scan(tiny),chrome:scan(chrome),side:scan(side)};
}

export async function GET(request:Request){
  const url=new URL(request.url);
  if(url.searchParams.get("key")!=="pocket-next-internal") return NextResponse.json({error:"not found"},{status:404});
  const robust=url.searchParams.get("robust")==="1";
  const debug=url.searchParams.get("debug")==="1";
  const maskRaw=url.searchParams.get("mask");
  const rowMaskFraction=maskRaw===null?undefined:Number(maskRaw);
  const radiusRaw=url.searchParams.get("radius");
  const patternRadiusOverride=radiusRaw===null?undefined:Number(radiusRaw);
  const contrastRaw=url.searchParams.get("contrast");
  const neutralContrastOverride=contrastRaw===null?undefined:Number(contrastRaw);
  const only=url.searchParams.get("only");
  const selectedCases=only?CASES.filter(test=>test.id===only):CASES;
  const results=[] as any[];
  for(const test of selectedCases){
    try{
      const buffer=await fetchImage(test.url);
      if(robust){
        const variants=await scanRobust(buffer,rowMaskFraction,patternRadiusOverride,neutralContrastOverride);
        const visible=(scan:DeviceLocalScan)=>scan.patterns.filter(pattern=>pattern.confidence!=="LOW").map(pattern=>pattern.name);
        results.push({
          ...test,
          variants:{
            base:{patterns:visible(variants.base),levels:variants.base.levels.length,liquidity:variants.base.liquidity.zones.length,candles:variants.base.candleCount},
            small:{patterns:visible(variants.small),levels:variants.small.levels.length,liquidity:variants.small.liquidity.zones.length,candles:variants.small.candleCount},
            tiny:{patterns:visible(variants.tiny),levels:variants.tiny.levels.length,liquidity:variants.tiny.liquidity.zones.length,candles:variants.tiny.candleCount},
            chrome:{patterns:visible(variants.chrome),levels:variants.chrome.levels.length,liquidity:variants.chrome.liquidity.zones.length,candles:variants.chrome.candleCount},
            side:{patterns:visible(variants.side),levels:variants.side.levels.length,liquidity:variants.side.liquidity.zones.length,candles:variants.side.candleCount},
          }
        });
      }else{
        const scanResult=await scan(buffer,420,debug,rowMaskFraction,patternRadiusOverride,neutralContrastOverride);
        results.push({...test,scan:scanResult});
      }
    }catch(error){
      results.push({...test,error:error instanceof Error?error.message:String(error)});
    }
  }
  if(robust){
    const usable=results.filter(item=>!item.error&&item.variants);
    let patternStable=0,levelStable=0,liquidityStable=0;
    const unstable:any[]=[];
    for(const item of usable){
      const names=(variant:any)=>JSON.stringify(variant.patterns);
      const variantList=[item.variants.base,item.variants.small,item.variants.tiny,item.variants.chrome,item.variants.side];
      const p=variantList.every((variant:any)=>names(item.variants.base)===names(variant));
      const l=variantList.every((variant:any)=>variant.levels>=2);
      const q=variantList.every((variant:any)=>variant.liquidity>=1);
      if(p)patternStable++; if(l)levelStable++; if(q)liquidityStable++;
      if(!p||!l||!q)unstable.push({id:item.id,...item.variants});
    }
    return NextResponse.json({count:results.length,usable:usable.length,patternStable,levelStable,liquidityStable,unstable,errors:results.filter(item=>item.error)});
  }
  if(url.searchParams.get("summary")==="1"){
    const norm=(name:string)=>name.replace(" CANDIDATE","").trim();
    let usable=0,positives=0,negatives=0,exact=0,negativePass=0,strongWrong=0,qualified=0;
    const failures:any[]=[];
    for(const item of results){
      if(item.error||!item.scan)continue;
      usable++;
      const patterns=(item.scan.patterns??[]) as DeviceLocalScan["patterns"];
      const visible=patterns.filter(pattern=>pattern.confidence!=="LOW");
      qualified+=visible.length;
      if(item.expected==="NO CLEAN PATTERN"){
        negatives++;
        if(!visible.length)negativePass++;
        else{strongWrong++;failures.push({id:item.id,expected:item.expected,got:visible.map(pattern=>pattern.name)});}
      }else{
        positives++;
        if(patterns.some(pattern=>norm(pattern.name)===norm(item.expected)))exact++;
        else{
          if(visible.length)strongWrong++;
          failures.push({id:item.id,expected:item.expected,got:patterns.map(pattern=>pattern.name)});
        }
      }
    }
    return NextResponse.json({
      count:results.length,usable,positives,negatives,exact,negativePass,strongWrong,qualified,
      errors:results.filter(item=>item.error).map(item=>({id:item.id,error:item.error})),
      failures
    });
  }
  return NextResponse.json({count:results.length,results});
}
