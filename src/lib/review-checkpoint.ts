import {defaultSettings,shippingModelVersion} from './selling-economics';

export function reviewCheckpointCurrent(manifest:{asOf?:string;shipping_model_version?:string;settings?:Record<string,unknown>},evidenceAsOf:string){
 return manifest.asOf===evidenceAsOf&&manifest.shipping_model_version===shippingModelVersion&&
  Object.entries(defaultSettings).every(([key,value])=>manifest.settings?.[key]===value);
}
