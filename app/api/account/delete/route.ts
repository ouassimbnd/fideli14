import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const publishable=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!publishable||!service)return NextResponse.json({error:"Suppression indisponible"},{status:503});
 const token=request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
 if(!token)return NextResponse.json({error:"Connexion requise"},{status:401});
 const publicClient=createClient(url,publishable,{auth:{persistSession:false}});
 const {data:{user},error}=await publicClient.auth.getUser(token);
 if(error||!user)return NextResponse.json({error:"Session invalide"},{status:401});
 const admin=createClient(url,service,{auth:{persistSession:false}});
 const deleted=await admin.auth.admin.deleteUser(user.id);
 if(deleted.error)return NextResponse.json({error:"Suppression impossible"},{status:500});
 return NextResponse.json({ok:true});
}
