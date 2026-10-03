/** Read complete boundary labels without expanding the drawable candle plot.
 * A model plot edge can cut through a font or sit slightly inside a grid row.
 * The bounded margin only supplies original OCR/grid pixels; it never supplies prices.
 */
export function axisReadingBounds<T extends {top:number;bottom:number}>(bounds:T,height:number):T{
 if(!Number.isFinite(height)||height<=0||![bounds.top,bounds.bottom].every(Number.isFinite))return bounds;
 const padding=Math.min(40,Math.max(12,height*.015))/height*100;
 return {...bounds,top:Math.max(0,bounds.top-padding),bottom:Math.min(100,bounds.bottom+padding)};
}
