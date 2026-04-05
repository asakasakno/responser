import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the calling user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role using service role client
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();

    switch (action) {
      case "list_users": {
        const { data: profiles } = await adminClient
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        const { data: subscriptions } = await adminClient
          .from("subscriptions")
          .select("*")
          .eq("status", "active");

        const { data: usageData } = await adminClient
          .from("usage")
          .select("user_id, count, date");

        const users = (profiles || []).map((profile: any) => {
          const sub = (subscriptions || []).find(
            (s: any) => s.user_id === profile.user_id
          );
          const userUsage = (usageData || []).filter(
            (u: any) => u.user_id === profile.user_id
          );
          const todayUsage = userUsage.find(
            (u: any) => u.date === new Date().toISOString().split("T")[0]
          );
          const totalUsage = userUsage.reduce((sum: number, u: any) => sum + u.count, 0);
          return {
            ...profile,
            platforms: profile.platforms || [],
            plan: sub?.plan || "free",
            payment_enabled: sub?.payment_enabled ?? true,
            subscription_id: sub?.id,
            today_usage: todayUsage?.count || 0,
            total_usage: totalUsage,
          };
        });

        return new Response(JSON.stringify({ users }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "change_plan": {
        const { user_id, plan } = params;
        if (!user_id || !plan) {
          return new Response(JSON.stringify({ error: "user_id and plan required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const validPlans = ["free", "basic", "pro"];
        if (!validPlans.includes(plan)) {
          return new Response(JSON.stringify({ error: "Invalid plan" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await adminClient
          .from("subscriptions")
          .update({ plan, updated_at: new Date().toISOString() })
          .eq("user_id", user_id)
          .eq("status", "active");

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "toggle_payment": {
        const { user_id, payment_enabled } = params;
        if (!user_id || payment_enabled === undefined) {
          return new Response(JSON.stringify({ error: "user_id and payment_enabled required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await adminClient
          .from("subscriptions")
          .update({ payment_enabled, updated_at: new Date().toISOString() })
          .eq("user_id", user_id)
          .eq("status", "active");

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "toggle_suspend": {
        const { user_id, suspended } = params;
        if (!user_id || suspended === undefined) {
          return new Response(JSON.stringify({ error: "user_id and suspended required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await adminClient
          .from("profiles")
          .update({ suspended, updated_at: new Date().toISOString() })
          .eq("user_id", user_id);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
