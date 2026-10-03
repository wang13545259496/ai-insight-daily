export interface VerificationStats {


  total:number;


  verified:number;


  warning:number;


  failed:number;


  verifiedRate:number;


}



export const defaultVerificationStats:

VerificationStats = {


  total:0,


  verified:0,


  warning:0,


  failed:0,


  verifiedRate:0,


};