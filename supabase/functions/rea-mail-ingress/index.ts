import PostalMime from "npm:postal-mime@4.0.11";
import {createIngress} from "../../../mail/ingress.mjs";
import {createMailStore} from "../../../scripts/mail-rest-store.mjs";
const store=createMailStore({url:Deno.env.get("SUPABASE_URL")!,key:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!});
Deno.serve(createIngress({store,parseMime:(raw:Uint8Array)=>PostalMime.parse(raw)}));
