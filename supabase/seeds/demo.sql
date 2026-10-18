-- Bridgify agency demo v1. Run the WHOLE file in the Supabase SQL Editor.
-- Requires all migrations through 202610190024_product_recovery.sql.
-- Set v_workspace_id below, or set bridgify.demo_workspace_id for this session.
-- No existing records are updated. Re-running preserves your demo edits.
-- All companies, people, agreements, messages and approvals below are fictional.
-- No Photon connections, document jobs or outbound messages are created.
begin;

create or replace function pg_temp.bridgify_demo_id(workspace uuid, label text)
returns uuid language sql immutable as $$
  select (substr(h,1,8)||'-'||substr(h,9,4)||'-4'||substr(h,14,3)||'-8'||
    substr(h,18,3)||'-'||substr(h,21,12))::uuid
  from (select md5('bridgify:agency-demo:v1:'||workspace::text||':'||label) h) x
$$;

do $demo$
declare
  -- Replace NULL with your workspace UUID in single quotes when running manually.
  v_workspace_id uuid := null;
  v_owner uuid;
  v_now timestamptz := date_trunc('minute', now());
  v_project uuid; v_document uuid; v_span uuid; v_event uuid; v_message uuid;
  v_job uuid; v_request uuid; v_task uuid; v_decision uuid; v_proposal uuid;
  v_terms jsonb; v_commercial jsonb; v_review jsonb; v_policy jsonb;
  v_intent jsonb; v_proposal_terms jsonb; v_proof jsonb;
  v_scope public.scope_versions;
  v_p jsonb; v_t jsonb; v_r jsonb; v_q jsonb; v_line jsonb;
  v_projects jsonb := $projects$[
    {"key":"northstar","name":"Northstar Analytics — Product Launch","client":"Northstar Analytics","contact":"Maya Chen","amount":1850000,"due_days":12,"age":28,"status":"active","allowance":8,"rounds":false,
     "inclusion":"Design and build a responsive five-page marketing website: Home, Product, Solutions, About and Contact. Includes launch messaging, accessible components and analytics setup.",
     "exclusion":"Additional landing pages, CRM integrations, customer portals and ongoing content production require a separate written change order.",
     "responsibility":"Client supplies approved product screenshots, brand assets and final legal copy before implementation begins.",
     "targets":["home.hero","home.primary_cta","product.features"],
     "tasks":[
       ["Approve launch messaging and information architecture","Signed sitemap covers five pages; final positioning approved by marketing lead."],
       ["Build responsive homepage and product templates","Layouts pass QA at 375, 768 and 1440 pixels; keyboard navigation works throughout."],
       ["Implement accessible product comparison table","Feature rows match approved product matrix; headers are announced correctly by screen readers."],
       ["Configure launch conversion events","Track demo requests and primary CTA clicks; verify events in the analytics debug view."],
       ["Finalize customer proof section","Publish three approved customer quotes with names, roles and written permission."]],
     "blocked":"Waiting for Maya to approve the final customer quotes and headshots.",
     "requests":[
       {"title":"Update homepage headline for the launch","text":"Please replace the homepage headline Build better reports with Turn product data into confident decisions. Keep the existing layout.","target":"home.hero","op":"replace_text","old":"Build better reports","value":"Turn product data into confident decisions","days":4},
       {"title":"Use brand indigo for the demo button","text":"Can we change the main Book a demo button to our approved indigo, #4F46E5? No other styling changes.","target":"home.primary_cta","op":"change_color","value":"#4F46E5","days":2},
       {"title":"Add a Salesforce lead-routing integration","text":"Could the demo form create Salesforce leads and route enterprise prospects to the correct account executive?","reason":"scope_addition","evidence":"CRM integrations require a separate written change order.","days":1},
       {"title":"Bring the launch delivery forward by five days","text":"Our investor announcement moved. Could we deliver the entire website five days before the agreed launch date?","reason":"deadline_change","evidence":"Delivery date changes require written approval of a revised implementation plan.","days":1},
       {"title":"Clarify which customer quote should appear first","text":"Can we lead with the stronger customer quote on the homepage?","missing":["replacement_text"],"days":1},
       {"title":"Confirm the homepage is ready for review","text":"Is the responsive homepage ready for our marketing review?","days":3}]
    },
    {"key":"evergreen","name":"Evergreen Health — Patient Website","client":"Evergreen Family Health","contact":"Dr. Lena Ortiz","amount":1280000,"due_days":18,"age":24,"status":"review_only","allowance":2,"rounds":true,
     "inclusion":"Design and develop a six-page informational clinic website with provider profiles, services, insurance information and an appointment inquiry form. Includes two consolidated rounds of feedback.",
     "exclusion":"Patient accounts, clinical records, insurance verification, scheduling integrations and collection of health information are excluded.",
     "responsibility":"Clinic supplies approved provider biographies, service descriptions, photography and privacy notices. Inquiry form collects contact details only.",
     "targets":["home.hero","contact.submit","providers.intro"],
     "tasks":[
       ["Approve patient-friendly content structure","Clinic approves six-page sitemap and a plain-language navigation hierarchy."],
       ["Complete provider profile templates","Each profile includes approved credentials, specialty, photo and office location."],
       ["Build service pages with accessible navigation","Services use approved descriptions; navigation and form labels pass keyboard QA."],
       ["QA appointment inquiry form","Only name, contact details and preferred callback time are collected; no clinical details."],
       ["Publish approved clinic privacy notice","Use the clinic-approved text and display its effective date in the footer."]],
     "blocked":"Clinic counsel has not supplied the approved website privacy notice.",
     "requests":[
       {"title":"Use welcoming language in the homepage introduction","text":"Please replace Care for your family with Compassionate care, close to home in the homepage introduction.","target":"home.hero","op":"replace_text","old":"Care for your family","value":"Compassionate care, close to home","days":6},
       {"title":"Increase contrast on the appointment button","text":"Please use #166534 for the Request an appointment button so it matches our accessible green palette.","target":"contact.submit","op":"change_color","value":"#166534","days":3},
       {"title":"Add an online patient portal","text":"Can patients sign in to see their lab results and upcoming appointments from this website?","reason":"scope_addition","evidence":"Patient accounts and clinical records are explicitly excluded from the informational website.","days":2},
       {"title":"Review an additional round of provider edits","text":"We have another full set of provider biography changes after the two feedback rounds. Can you include these too?","reason":"exhausted_allowance","evidence":"The agreement includes two consolidated rounds of feedback; both rounds are closed.","days":1},
       {"title":"Clarify the replacement provider introduction","text":"Please make the provider introduction sound warmer.","missing":["replacement_text"],"days":1},
       {"title":"Confirm provider profiles passed review","text":"Have the provider profile templates passed the clinic review?","days":4}]
    },
    {"key":"cascadia","name":"Cascadia Goods — Storefront Refresh","client":"Cascadia Outdoor Goods","contact":"Ethan Brooks","amount":2400000,"due_days":9,"age":35,"status":"active","allowance":6,"rounds":false,
     "inclusion":"Refresh the existing Shopify storefront with a redesigned homepage, collection template, product detail template and cart styling. Includes responsive QA and existing product content migration.",
     "exclusion":"Subscriptions, loyalty programs, custom checkout logic, ERP integrations and new international storefronts require separate approval.",
     "responsibility":"Client provides final product photography, inventory data and shipping rules; client retains responsibility for tax and fulfillment configuration.",
     "targets":["home.hero","collection.cta","product.description"],
     "tasks":[
       ["Approve merchandising and collection navigation","Navigation exposes core collections and seasonal campaign without adding duplicate taxonomy."],
       ["Complete collection and product templates","Cards show approved photography, price and availability across all supported breakpoints."],
       ["Implement cart accessibility improvements","Cart quantity changes announce totals; focus returns correctly after removing an item."],
       ["Run mobile purchase-flow QA","Test product selection, cart updates and handoff to existing checkout on iOS and Android."],
       ["Replace seasonal campaign photography","Use final licensed images with approved crops and descriptive alt text."]],
     "blocked":"Final lifestyle photography is awaiting sign-off from the merchandising team.",
     "requests":[
       {"title":"Update the seasonal campaign headline","text":"Please replace Ready for the outdoors with Built for the trails ahead in the homepage hero.","target":"home.hero","op":"replace_text","old":"Ready for the outdoors","value":"Built for the trails ahead","days":5},
       {"title":"Use evergreen for collection action buttons","text":"Change the collection Shop now button color to #14532D using the existing button style.","target":"collection.cta","op":"change_color","value":"#14532D","days":2},
       {"title":"Add a curated gear finder","text":"Could we add a short gear-finder quiz that recommends a collection based on activity and season?","reason":"scope_addition","evidence":"The confirmed storefront refresh covers existing templates; a new interactive recommendation flow requires approval.","days":5},
       {"title":"Introduce a loyalty rewards program","text":"Can shoppers earn points on each purchase and redeem them at checkout?","reason":"scope_addition","evidence":"Loyalty programs and custom checkout logic require separate approval.","days":1},
       {"title":"Clarify the new product-detail copy","text":"Can you swap the product description for the updated version?","missing":["replacement_text"],"days":1},
       {"title":"Confirm collection templates are complete","text":"Are the refreshed collection templates ready for merchandising review?","days":4}]
    },
    {"key":"harbor","name":"Harbor Studio — Brand Launch","client":"Harbor Architecture Studio","contact":"Sofia Patel","amount":850000,"due_days":-3,"age":42,"status":"completed","allowance":4,"rounds":false,
     "inclusion":"Create a visual identity kit and a three-page portfolio website with Home, Selected Work and Contact. Deliver logo files, typography guidance and responsive website templates.",
     "exclusion":"Copywriting retainers, architectural renderings, additional case studies and ongoing hosting support are excluded.",
     "responsibility":"Client supplies approved project photography, credits and portfolio descriptions before publication.",
     "targets":["home.hero","contact.cta","work.intro"],
     "tasks":[
       ["Approve identity direction and typography","Partner approves final logo direction, color palette and type pairing."],
       ["Deliver brand asset library","Provide SVG and PNG logos, print-ready exports and a concise brand usage guide."],
       ["Build selected-work portfolio pages","Three approved projects display correctly with image credits and accessible captions."],
       ["Complete launch QA and handover","Verify mobile layouts, form delivery, redirects and editor access."],
       ["Transfer final files and record acceptance","Client receives editable assets, site access and documented launch acceptance."]],
     "blocked":"",
     "requests":[
       {"title":"Finalize the studio positioning line","text":"Please replace Thoughtful spaces with Architecture for everyday life in the homepage introduction.","target":"home.hero","op":"replace_text","old":"Thoughtful spaces","value":"Architecture for everyday life","days":8},
       {"title":"Match the contact button to the brand palette","text":"Please set the contact button color to our approved slate #334155.","target":"contact.cta","op":"change_color","value":"#334155","days":7}]
    },
    {"key":"atlas","name":"Atlas Logistics — Customer Portal","client":"Atlas Freight Partners","contact":"Daniel Kim","amount":3200000,"due_days":25,"age":31,"status":"paused","allowance":5,"rounds":false,
     "inclusion":"Design and build a customer portal prototype with shipment dashboard, shipment detail and document download views using the existing shipment API. Includes role-based navigation and responsive templates.",
     "exclusion":"New carrier integrations, live billing, route optimization, automated claims and changes to the shipment API are excluded.",
     "responsibility":"Client supplies sandbox API access, sample shipment records and approved customer roles. Delivery depends on documented API availability.",
     "targets":["dashboard.heading","shipment.status","documents.download"],
     "tasks":[
       ["Approve shipment dashboard prototype","Operations team approves dashboard hierarchy and customer role visibility."],
       ["Build shipment detail and document templates","Views match approved designs and use the documented shipment response schema."],
       ["Implement shipment status filtering","Filters preserve selected date range and expose meaningful empty and error states."],
       ["Verify customer-role permissions","Confirm each customer role sees only its allowed navigation and sample records."],
       ["Connect shipment sandbox API","Fetch sample shipments and documents with the client-provided sandbox credentials."]],
     "blocked":"Project paused while Atlas rotates sandbox API credentials and confirms customer roles.",
     "requests":[
       {"title":"Clarify the shipment dashboard heading","text":"Please replace Your deliveries with Shipment overview on the dashboard.","target":"dashboard.heading","op":"replace_text","old":"Your deliveries","value":"Shipment overview","days":7},
       {"title":"Use amber for the delayed-shipment status","text":"Please change the delayed shipment indicator to #B45309 without changing the status logic.","target":"shipment.status","op":"change_color","value":"#B45309","days":4},
       {"title":"Add live invoice downloads","text":"Can customers also see their unpaid invoices and download a PDF for each invoice?","reason":"scope_addition","evidence":"Live billing is excluded from the shipment portal prototype.","days":3},
       {"title":"Deliver before the API dependency is ready","text":"Could we keep the original delivery date even if the replacement API credentials arrive next week?","reason":"deadline_change","evidence":"Delivery depends on documented API availability and client-provided sandbox access.","days":2},
       {"title":"Clarify the document download label","text":"Can we rename the document button to the wording operations suggested?","missing":["replacement_text"],"days":2},
       {"title":"Explain why portal work is paused","text":"What is still needed from us before work on the portal can resume?","days":1}]
    },
    {"key":"juniper","name":"Juniper Coffee — Wholesale Launch","client":"Juniper Coffee Roasters","contact":"Amara Davis","amount":680000,"due_days":30,"age":2,"status":"draft","allowance":3,"rounds":false}
  ]$projects$::jsonb;
  v_proposals jsonb := $proposals$[
    {"key":"salesforce","project":"northstar","request":3,"status":"awaiting_client","title":"Salesforce lead routing and attribution","explanation":"Extend the launch website with consent-aware lead capture and account routing in the existing Salesforce organization.","amount":280000,"days":1,"due_days":17,"lines":[{"key":"lead-capture","title":"Connect demo inquiries to Salesforce","acceptance_criteria":"Validated inquiries create one lead with source attribution, consent timestamp and duplicate protection."},{"key":"routing","title":"Route enterprise inquiries to account owners","acceptance_criteria":"Region and company-size rules route test leads correctly; failures generate an internal alert."}],"exclusions":["Salesforce license fees and administration","Historical lead migration"]},
    {"key":"rush","project":"northstar","request":4,"status":"draft","title":"Accelerated launch delivery plan","explanation":"Reserve additional implementation and QA capacity to deliver five days earlier, contingent on final assets within two business days.","amount":175000,"days":1,"due_days":7,"lines":[{"key":"rush-qa","title":"Add dedicated launch QA capacity","acceptance_criteria":"Complete the original acceptance checklist before the accelerated launch date with client assets supplied on time."}],"exclusions":["New scope or additional design revisions"]},
    {"key":"patient-portal","project":"evergreen","request":3,"status":"declined","title":"Patient portal discovery engagement","explanation":"Assess an integration with the clinic's existing patient portal vendor before estimating implementation.","amount":350000,"days":2,"lines":[{"key":"portal-discovery","title":"Document patient portal integration requirements","acceptance_criteria":"Deliver an approved integration brief covering identity, data boundaries and vendor responsibilities."}],"exclusions":["Implementation or storage of clinical records","Vendor subscription fees"]},
    {"key":"gear-finder","project":"cascadia","request":3,"status":"approved","title":"Seasonal gear finder and merchandising flow","explanation":"Add an accessible, three-question gear finder that routes shoppers to existing collections without collecting personal information.","amount":420000,"days":4,"lines":[{"key":"gear-quiz","title":"Build the three-question gear finder","acceptance_criteria":"Activity, season and trip duration produce a deterministic collection recommendation; the flow works with keyboard and screen reader."},{"key":"gear-events","title":"Track gear-finder completion and collection clicks","acceptance_criteria":"Analytics records quiz starts, completions and recommended collection clicks with no personal information."}],"exclusions":["Personalized customer accounts","Third-party recommendation subscriptions"]},
    {"key":"loyalty","project":"cascadia","request":4,"status":"awaiting_client","title":"Loyalty program discovery and vendor selection","explanation":"Evaluate supported loyalty apps and define a points model before approving checkout changes.","amount":195000,"days":1,"lines":[{"key":"loyalty-discovery","title":"Deliver a loyalty program implementation brief","acceptance_criteria":"Compare three supported vendors and document earn, redeem, refund and support requirements."}],"exclusions":["App subscription fees","Checkout implementation"]},
    {"key":"invoices","project":"atlas","request":3,"status":"changes_requested","title":"Invoice download integration","explanation":"Extend the portal with invoice summaries and signed PDF downloads using the existing billing service.","amount":560000,"days":3,"lines":[{"key":"invoice-list","title":"Add invoice list and secure PDF downloads","acceptance_criteria":"Authorized customers see only their invoices; links expire after ten minutes; missing invoices show a useful empty state."}],"exclusions":["Payment collection","Changes to the billing service"]}
  ]$proposals$::jsonb;
  v_key text; v_text text; v_status text; v_state text; v_reply text;
  v_reason text; v_mode text; v_hash text; v_frozen text;
  v_at timestamptz; v_due date; v_i integer; v_count integer; v_existing integer;
begin
  v_workspace_id := coalesce(v_workspace_id,
    nullif(current_setting('bridgify.demo_workspace_id', true), '')::uuid);
  if v_workspace_id is null then
    raise exception 'Set v_workspace_id near the top of this script to the workspace UUID from public.organizations.';
  end if;
  if to_regclass('public.proposal_responses') is null or not exists (
    select 1 from information_schema.columns where table_schema='public'
      and table_name='projects' and column_name='approved_total_cents'
  ) or not exists (
    select 1 from information_schema.columns where table_schema='public'
      and table_name='project_tasks' and column_name='internal_due_date'
  ) then
    raise exception 'Apply all repository migrations through 202610190024_product_recovery.sql first.';
  end if;
  select count(*), (array_agg(user_id))[1] into v_count, v_owner
    from public.organization_members where organization_id=v_workspace_id and role='owner';
  if v_count<>1 then raise exception 'Choose a workspace with exactly one existing owner.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('bridgify:agency-demo:v1:'||v_workspace_id::text,0));
  -- This marker is written last in the same transaction. Keep edited demo data on reruns.
  if exists(select 1 from public.audit_events
    where project_id=pg_temp.bridgify_demo_id(v_workspace_id,'project:northstar')
      and action='demo:seed:v1' and details->>'dataset'='agency-demo-v1') then
    select count(*) into v_existing from public.projects p join jsonb_array_elements(v_projects) x
      on p.id=pg_temp.bridgify_demo_id(v_workspace_id,'project:'||(x->>'key'))
      where p.organization_id=v_workspace_id;
    if v_existing<>6 then raise exception 'Demo was partially removed. Restore missing projects or use another workspace; no records changed.'; end if;
    raise notice 'Demo already exists; preserving all demo edits. No records changed.';
    return;
  end if;

  for v_p in select value from jsonb_array_elements(v_projects) loop
    v_key:=v_p->>'key';
    v_project:=pg_temp.bridgify_demo_id(v_workspace_id,'project:'||v_key);
    if exists(select 1 from public.projects where id=v_project) then
      raise exception 'Demo project identity collision. No existing data was changed.';
    end if;
    v_document:=pg_temp.bridgify_demo_id(v_workspace_id,'document:'||v_key);
    v_span:=pg_temp.bridgify_demo_id(v_workspace_id,'span:'||v_key);
    v_due:=(v_now at time zone 'America/Los_Angeles')::date+(v_p->>'due_days')::integer;
    v_at:=v_now-make_interval(days=>(v_p->>'age')::integer);
    insert into public.projects(id,organization_id,owner_id,name,client_name,
      original_amount_cents,currency,timezone,agreed_due_date,status,setup_step,
      version,scope_version,policy_version,activation_cutoff,disclosure_at,created_at,updated_at)
    values(v_project,v_workspace_id,v_owner,v_p->>'name',v_p->>'client',
      (v_p->>'amount')::bigint,'USD','America/Los_Angeles',v_due,v_p->>'status',
      case when v_key='juniper' then 2 else 5 end,1,
      case when v_key='juniper' then 0 else 1 end,
      case when v_key='juniper' then 0 else 1 end,
      case when v_key='juniper' then null else v_at+interval '2 days' end,
      null,v_at,v_now-interval '30 minutes');
    insert into public.audit_events(project_id,actor_id,action,version,details,created_at)
      values(v_project,v_owner,'basics',1,jsonb_build_object('reason','Fictional agency demo: project brief created'),v_at);
    if v_key='juniper' then continue; end if;

    v_text:=format(E'STATEMENT OF WORK\n%s\nClient contact: %s\n\nIncluded work: %s\n\nExcluded work: %s\n\nClient responsibilities: %s\n\nFixed project fee: USD %s.\nAgreed delivery date: %s.\nRevision allowance: %s %s.\nDelivery date changes require written approval of a revised implementation plan.',
      v_p->>'name',v_p->>'contact',v_p->>'inclusion',v_p->>'exclusion',v_p->>'responsibility',
      to_char((v_p->>'amount')::numeric/100,'FM999999990.00'),v_due,
      v_p->>'allowance',case when (v_p->>'rounds')::boolean then 'consolidated rounds of feedback' else 'individual change requests' end);
    v_terms:=jsonb_build_array(
      jsonb_build_object('kind','inclusion','text',v_p->>'inclusion','span_id',v_span,'quote',v_p->>'inclusion'),
      jsonb_build_object('kind','exclusion','text',v_p->>'exclusion','span_id',v_span,'quote',v_p->>'exclusion'),
      jsonb_build_object('kind','responsibility','text',v_p->>'responsibility','span_id',v_span,'quote',v_p->>'responsibility'),
      jsonb_build_object('kind','revision','text',format('%s included %s',v_p->>'allowance',case when (v_p->>'rounds')::boolean then 'feedback rounds' else 'individual change requests' end),
        'span_id',v_span,'quote',format('Revision allowance: %s %s.',v_p->>'allowance',case when (v_p->>'rounds')::boolean then 'consolidated rounds of feedback' else 'individual change requests' end)),
      jsonb_build_object('kind','date','text','Delivery by '||v_due::text,'span_id',v_span,'quote','Agreed delivery date: '||v_due::text||'.'));
    v_commercial:=jsonb_build_object(
      'price',jsonb_build_object('amount_cents',(v_p->>'amount')::bigint,'currency','USD','span_id',v_span,'quote','Fixed project fee: USD '||to_char((v_p->>'amount')::numeric/100,'FM999999990.00')||'.'),
      'due_date',jsonb_build_object('value',v_due,'span_id',v_span,'quote','Agreed delivery date: '||v_due::text||'.'),
      'revision',jsonb_build_object('allowance',(v_p->>'allowance')::integer,'unit',case when (v_p->>'rounds')::boolean then 'rounds' else 'requests' end,'span_id',v_span,'quote',v_terms->3->>'quote'));
    v_review:=jsonb_build_object('terms',v_terms,'commercial',v_commercial,'issues','[]'::jsonb,'price_choice','agreement','date_choice','agreement');
    insert into public.documents(id,project_id,kind,original_text,status,extraction,review_draft,review_version,created_at)
      values(v_document,v_project,'text',v_text,'ready',jsonb_build_object('terms',v_terms,'commercial',v_commercial,'warnings','[]'::jsonb,'model','fictional-demo-fixture'),v_review,1,v_at+interval '1 hour');
    insert into public.document_spans(id,document_id,page,start_offset,end_offset,text)
      values(v_span,v_document,1,0,length(v_text),v_text);
    insert into public.scope_versions(project_id,version,document_id,terms,agreement,confirmed_by,confirmed_at)
      values(v_project,1,v_document,v_terms,v_review,v_owner,v_at+interval '1 day');
    v_mode:=case when (v_p->>'rounds')::boolean then 'review_only' else 'enabled' end;
    v_policy:=jsonb_build_object('mode',v_mode,'allowance_mode',case when (v_p->>'rounds')::boolean then 'manual_rounds' else 'per_request' end,
      'allowance',(v_p->>'allowance')::integer,'permission_mode','listed_operations','acceptance_guidance','',
      'operations',jsonb_build_array('replace_text','change_color'),'targets',v_p->'targets',
      'exclusions',v_p->>'exclusion','max_open_tasks',10,'notifications','dashboard',
      'replies',jsonb_build_object('progress_updates',false,'status_questions',true,'clarifications',true,'review_acknowledgments',true));
    insert into public.policy_versions(project_id,version,policy,confirmed_by,created_at)
      values(v_project,1,v_policy,v_owner,v_at+interval '1 day');
    update public.projects set current_agreement_document_id=v_document,policy=v_policy where id=v_project;
    insert into public.audit_events(project_id,actor_id,action,version,details,created_at)
      values(v_project,v_owner,'scope',1,jsonb_build_object('reason','Agreement scope and commercial terms confirmed'),v_at+interval '1 day'),
        (v_project,v_owner,'policy',1,jsonb_build_object('reason','Revision allowance and acceptance rules confirmed'),v_at+interval '25 hours');

    v_i:=0;
    for v_t in select value from jsonb_array_elements(v_p->'tasks') loop
      v_i:=v_i+1;
      v_task:=pg_temp.bridgify_demo_id(v_workspace_id,'baseline:'||v_key||':'||v_i);
      v_status:=case when v_key='harbor' or v_i<=2 then 'done' when v_i=3 then 'in_progress' when v_i=4 then 'ready' else 'blocked' end;
      insert into public.project_tasks(id,project_id,task_code,title,status,priority,assignee,
        agreed_due_date,internal_due_date,origin,origin_text,blocked_reason,acceptance_criteria,
        source_text,source_meta,authorized_by,internal_note,history,created_at,updated_at)
      values(v_task,v_project,'TASK-'||upper(v_key)||'-'||lpad(v_i::text,3,'0'),v_t->>0,v_status,
        case when v_i in (3,5) then 'high' else 'normal' end,
        case when v_i in (1,5) then 'Alex Morgan' when v_i in (2,3) then 'Jordan Lee' else 'Sam Rivera' end,
        v_due,v_due-case when v_i<4 then 4 else 2 end,'agreement','Confirmed statement of work · scope v1',
        case when v_status='blocked' then v_p->>'blocked' else null end,v_t->>1,
        v_p->>'inclusion','Statement of work · page 1',v_owner::text,
        case when v_status='blocked' then 'Follow up with '||(v_p->>'contact')||' before assigning implementation capacity.' else 'Use the approved brief and record QA evidence before marking complete.' end,
        jsonb_build_array('Created from the confirmed agreement',case when v_status='done' then 'QA passed and client review recorded' when v_status='blocked' then v_p->>'blocked' else 'Assigned during weekly delivery planning' end),
        v_at+interval '2 days',case when v_status='done' then v_now-make_interval(days=>10+v_i) else v_now-make_interval(hours=>v_i) end);
      insert into public.audit_events(project_id,actor_id,action,version,details,created_at)
        values(v_project,v_owner,case when v_status='done' then 'task:status' else 'task:create' end,1,
          jsonb_build_object('taskId',v_task,'status',v_status,'reason',v_t->>0),
          case when v_status='done' then v_now-make_interval(days=>10+v_i) else v_now-make_interval(hours=>v_i) end);
    end loop;

    v_i:=0;
    for v_r in select value from jsonb_array_elements(v_p->'requests') loop
      v_i:=v_i+1;
      v_event:=pg_temp.bridgify_demo_id(v_workspace_id,'event:'||v_key||':'||v_i);
      v_message:=pg_temp.bridgify_demo_id(v_workspace_id,'message:'||v_key||':'||v_i);
      v_job:=pg_temp.bridgify_demo_id(v_workspace_id,'job:'||v_key||':'||v_i);
      v_request:=pg_temp.bridgify_demo_id(v_workspace_id,'request:'||v_key||':'||v_i);
      v_task:=null; v_decision:=null;
      v_at:=v_now-make_interval(days=>(v_r->>'days')::integer,hours=>v_i);
      v_reason:=v_r->>'reason';
      v_state:=case when v_i<=2 then 'accepted' when v_reason is not null then 'owner_review' when v_i=5 then 'awaiting_details' else 'closed' end;
      v_intent:=jsonb_build_object('intent',case when v_i=6 then 'status_question' else 'new_request' end,
        'summary',v_r->>'title','existingRequestId',null,'taskId',null,
        'operation',case when v_i=6 then null else coalesce(v_r->>'op','project_change') end,
        'targetId',v_r->>'target','payload',jsonb_build_object('replacementText',case when v_r->>'op'='replace_text' then v_r->>'value' else null end,
          'locator',v_r->>'old','color',case when v_r->>'op'='change_color' then v_r->>'value' else null end,
          'targetDescription',coalesce(v_r->>'target',v_r->>'title'),
          'instructions',case when v_r->>'op' is null and v_i<>6 then v_r->>'text' else null end),
        'sources',jsonb_build_array(jsonb_build_object('revisionId',v_message,'quote',v_r->>'text')),
        'scopeEvidence',jsonb_build_array(jsonb_build_object('scopeItemId','scope-'||case when v_reason='scope_addition' then '1' else '0' end,
          'quote',case when v_reason='scope_addition' then v_p->>'exclusion' else v_p->>'inclusion' end)),
        'missingFields',coalesce(v_r->'missing','[]'::jsonb),'ambiguous',v_i=5,'conflicting',false,
        'requestsNewDeadline',coalesce(v_reason='deadline_change',false),'scopeAssessment',case when v_reason='scope_addition' then 'excluded' else 'included' end,
        'violatesPolicyExclusions',coalesce(v_reason='scope_addition',false),'policyAssessment',case when v_i<=2 then 'allowed' else 'review' end);
      insert into public.automation_events(id,project_id,instance_id,event_key,fingerprint,event,disposition,created_at)
        values(v_event,v_project,'demo-offline:'||v_project::text,'demo:'||v_message::text,md5(v_r->>'text'),
          jsonb_build_object('kind','message','messageGuid','demo:'||v_message::text,'text',v_r->>'text',
            'senderId','demo:'||v_key,'chatGuid','demo-offline:'||v_project::text,'direction','inbound','demo',true),
          'demo_fixture',v_at);
      insert into public.automation_messages(id,project_id,event_id,provider_guid,role,text,occurred_at,created_at)
        values(v_message,v_project,v_event,'demo:'||v_message::text,'requester',v_r->>'text',v_at,v_at);
      insert into public.automation_jobs(id,project_id,event_id,message_id,review_reason,state,attempts,analysis,model,prompt_version,available_at,created_at)
        values(v_job,v_project,v_event,v_message,v_reason,'done',1,jsonb_build_object('intents',jsonb_build_array(v_intent)),
          'fictional-demo-fixture','demo-v1',v_at,v_at);
      insert into public.automation_requests(id,project_id,job_id,ordinal,state,summary,intent,source_ids,clarification_turns,created_at,updated_at)
        values(v_request,v_project,v_job,0,v_state,v_r->>'title',v_intent,jsonb_build_array(v_message),case when v_i=5 then 1 else 0 end,v_at,v_at+interval '1 minute');
      if v_i<=2 then
        v_task:=pg_temp.bridgify_demo_id(v_workspace_id,'accepted-task:'||v_key||':'||v_i);
        v_status:=case when v_i=1 or v_key='harbor' then 'done' else 'ready' end;
        insert into public.project_tasks(id,project_id,task_code,title,status,priority,assignee,
          agreed_due_date,internal_due_date,origin,origin_text,request_code,operation,target_id,value,
          acceptance_criteria,source_text,source_meta,authorized_by,revision_unit,history,created_at,updated_at)
        values(v_task,v_project,'TASK-'||upper(v_key)||'-'||lpad((v_i+5)::text,3,'0'),v_r->>'title',v_status,'normal','Jordan Lee',
          v_due,least(v_due,(v_now at time zone 'America/Los_Angeles')::date+2),'auto',
          case when (v_p->>'rounds')::boolean then 'Owner approved in consolidated feedback round' else 'Accepted within the confirmed agreement and automation rules' end,
          'REQ-'||left(v_request::text,8),v_r->>'op',v_r->>'target',v_r->>'value',
          case when v_r->>'op'='replace_text' then 'Display the exact approved replacement copy without altering layout.' else 'Apply the approved hex color and verify accessible contrast.' end,
          v_r->>'text',v_p->>'contact'||' · recorded demo request',
          case when (v_p->>'rounds')::boolean then v_owner::text else 'Bridgify · confirmed policy v1' end,
          case when (v_p->>'rounds')::boolean then 'round' else 'request' end,
          jsonb_build_array('Client request recorded',case when (v_p->>'rounds')::boolean then 'Owner approved the request within a feedback round' else 'Scope, policy and remaining allowance verified' end,
            case when v_status='done' then 'Implemented and verified against acceptance criteria' else 'Ready for the assigned designer to implement' end),v_at,v_at+interval '2 hours');
        update public.automation_requests set task_id=v_task where id=v_request;
        if (v_p->>'rounds')::boolean then
          insert into public.automation_rounds(id,project_id,title,state,created_at,closed_at)
            values(pg_temp.bridgify_demo_id(v_workspace_id,'round:'||v_key||':'||v_i),v_project,'Clinic feedback round '||v_i,'closed',v_at-interval '1 day',v_at+interval '1 hour');
          insert into public.automation_round_members(request_id,round_id,project_id,created_at)
            values(v_request,pg_temp.bridgify_demo_id(v_workspace_id,'round:'||v_key||':'||v_i),v_project,v_at);
        else
          insert into public.automation_revision_uses(request_id,project_id,policy_version,scope_version,created_at)
            values(v_request,v_project,1,1,v_at);
        end if;
        v_reply:='Accepted “'||(v_r->>'title')||'” for the project team to carry out. This uses one included '||case when (v_p->>'rounds')::boolean then 'feedback round, approved by the owner.' else 'change request.' end;
      elsif v_reason is not null then
        v_decision:=pg_temp.bridgify_demo_id(v_workspace_id,'decision:'||v_key||':'||v_i);
        insert into public.owner_decisions(id,project_id,decision_code,request_code,reason,title,severity,status,
          source_text,source_meta,evidence,evidence_source,explanation,missing_details,suggested_options,
          reply_preview,internal_note,history,automation_request_id,source_job_id,created_at,updated_at)
        values(v_decision,v_project,'DEC-'||left(v_decision::text,8),'REQ-'||left(v_request::text,8),v_reason,v_r->>'title',
          case when v_reason='deadline_change' then 'critical' else 'warning' end,
          case when v_key='atlas' then 'reviewing' else 'open' end,v_r->>'text',v_p->>'contact'||' · client request',
          v_r->>'evidence','Confirmed agreement · page 1',
          case v_reason when 'scope_addition' then 'This request adds work outside the agreed deliverables. Confirm commercial terms before authorizing implementation.'
            when 'deadline_change' then 'The requested timing changes a committed delivery date. Review dependencies, capacity and any rush fee before making a new commitment.'
            else 'The included feedback allowance has been used. Decide whether to quote additional work or make a documented exception.' end,
          '[]'::jsonb,jsonb_build_array(
            jsonb_build_object('title','Prepare a proposal','description','Define the additional deliverables, price and any delivery impact for client approval.'),
            jsonb_build_object('title','Ask for details','description','Clarify dependencies and acceptance criteria before making a commitment.'),
            jsonb_build_object('title','Decline the request','description','Explain the agreed scope and offer an appropriate next step.')),
          'Thanks for the request. I have flagged this for the project owner to review scope, timing and any additional fee before we commit.',
          'Discuss with '||(v_p->>'contact')||' during the next delivery check-in. Do not begin unapproved work.',
          jsonb_build_array('Routed for owner review; no work or additional fee has been authorized'),v_request,v_job,v_at,v_at);
        update public.automation_requests set decision_id=v_decision where id=v_request;
        v_reply:='I have put “'||(v_r->>'title')||'” in the owner review queue. It has not been accepted yet.';
      elsif v_i=5 then
        v_reply:='Happy to help. Please send the exact approved replacement wording so the team can make the change accurately.';
      else
        v_reply:=case when v_key='atlas' then 'Work is paused while we wait for replacement sandbox API credentials and confirmed customer roles. The owner will review the delivery plan when those are available.'
          else 'The approved templates are complete and ready for your review. Remaining implementation work is tracked in the project task list.' end;
      end if;
      -- Stored source/reply history only. No outbox record or fabricated delivery receipt.
      v_message:=pg_temp.bridgify_demo_id(v_workspace_id,'reply:'||v_key||':'||v_i);
      insert into public.automation_messages(id,project_id,provider_guid,role,text,occurred_at,created_at)
        values(v_message,v_project,'demo:'||v_message::text,'assistant',v_reply,v_at+interval '1 minute',v_at+interval '1 minute');
      insert into public.audit_events(project_id,actor_id,action,version,details,created_at)
        values(v_project,case when (v_p->>'rounds')::boolean and v_i<=2 then v_owner else null end,
          case when v_i<=2 then 'automation:accepted' when v_reason is not null then 'automation:owner_review' when v_i=5 then 'request:clarify' else 'automation:status_answer' end,1,
          jsonb_build_object('requestId',v_request,'taskId',v_task,'decisionId',v_decision,'scopeVersion',1,'policyVersion',1,'reason',v_r->>'title'),v_at+interval '1 minute');
      if v_key='evergreen' and v_i<=2 then
        insert into public.audit_events(project_id,actor_id,action,version,details,created_at)
          values(v_project,v_owner,'automation:round_close',1,jsonb_build_object('reason','Clinic consolidated feedback round '||v_i||' completed'),v_at+interval '1 hour');
      end if;
    end loop;
    insert into public.audit_events(project_id,actor_id,action,version,details,created_at)
      values(v_project,v_owner,'lifecycle:'||(v_p->>'status'),1,
        jsonb_build_object('reason',case when v_key='atlas' then v_p->>'blocked' when v_key='harbor' then 'Final handover accepted; website and brand files delivered.' else 'Fictional demonstration project prepared for delivery tracking.' end),
        case when v_key='harbor' then v_now-interval '3 days' when v_key='atlas' then v_now-interval '3 days' else v_now-make_interval(days=>(v_p->>'age')::integer)+interval '2 days' end);
  end loop;

  for v_q in select value from jsonb_array_elements(v_proposals) loop
    v_project:=pg_temp.bridgify_demo_id(v_workspace_id,'project:'||(v_q->>'project'));
    v_proposal:=pg_temp.bridgify_demo_id(v_workspace_id,'proposal:'||(v_q->>'key'));
    v_request:=pg_temp.bridgify_demo_id(v_workspace_id,'request:'||(v_q->>'project')||':'||(v_q->>'request'));
    v_at:=v_now-make_interval(days=>(v_q->>'days')::integer)+interval '1 hour';
    v_status:=v_q->>'status';
    v_proposal_terms:=jsonb_build_object('title',v_q->>'title','explanation',v_q->>'explanation',
      'lines',v_q->'lines','exclusions',v_q->'exclusions','superseded_terms','[]'::jsonb,
      'amount_cents',(v_q->>'amount')::bigint,'change_due_date',v_q ? 'due_days',
      'new_due_date',case when v_q ? 'due_days' then (v_now at time zone 'America/Los_Angeles')::date+(v_q->>'due_days')::integer else null end,
      'allowance_delta',0,'expires_at',v_now+interval '14 days','source_request_id',v_request);
    perform public.validate_proposal_terms(v_proposal_terms);
    v_frozen:=format(E'Proposal P-%s revision 1\n%s\n%s\nDeliverables:\n%s\nExclusions: %s\nAdditional project price: USD %s\nDeadline: %s\nRevision allowance adjustment: 0\nExpires: %s\nFictional demo terms; no message was transmitted.',
      left(v_proposal::text,8),v_q->>'title',v_q->>'explanation',
      (select string_agg('- '||(l->>'title')||E'\n  Acceptance: '||(l->>'acceptance_criteria'),E'\n') from jsonb_array_elements(v_q->'lines') l),
      (select string_agg(x,'; ') from jsonb_array_elements_text(v_q->'exclusions') x),
      to_char((v_q->>'amount')::numeric/100,'FM999999990.00'),
      coalesce(v_proposal_terms->>'new_due_date','Unchanged'),v_now+interval '14 days');
    v_hash:=encode(sha256(convert_to(v_proposal_terms::text,'UTF8')),'hex');
    insert into public.proposal_revisions(proposal_id,revision,project_id,status,shared_terms,internal_notes,
      expires_at,version,terms_hash,frozen_text,sent_at,expected_scope_version,source_request_id)
    values(v_proposal,1,v_project,v_status,v_proposal_terms,'Fictional demo proposal. Connect a verified client conversation before demonstrating live submission or recording a new response.',
      v_now+interval '14 days',case when v_status='draft' then 1 when v_status='awaiting_client' then 2 else 3 end,
      case when v_status='draft' then null else v_hash end,case when v_status='draft' then null else v_frozen end,
      case when v_status='draft' then null else v_at end,
      (select scope_version from public.projects where id=v_project),v_request);
    insert into public.audit_events(project_id,actor_id,action,version,details,created_at)
      values(v_project,v_owner,case when v_status='draft' then 'proposal:create' else 'proposal:send' end,1,
        jsonb_build_object('proposalId',v_proposal,'revision',1,'reason',v_q->>'title','demo',true),v_at);
    if v_status in ('approved','declined','changes_requested') then
      v_text:=case v_status when 'approved' then 'Approved: the two gear-finder deliverables and additional USD 4,200 are confirmed. Please proceed under the stated exclusions.'
        when 'declined' then 'Thanks for outlining the discovery phase. We will keep the patient portal with our current vendor and decline this proposal.'
        else 'Please revise the invoice proposal to include a CSV export option and split discovery from implementation pricing before we decide.' end;
      v_event:=pg_temp.bridgify_demo_id(v_workspace_id,'proposal-response-event:'||(v_q->>'key'));
      v_message:=pg_temp.bridgify_demo_id(v_workspace_id,'proposal-response:'||(v_q->>'key'));
      insert into public.automation_events(id,project_id,instance_id,event_key,fingerprint,event,disposition,created_at)
        values(v_event,v_project,'demo-offline:'||v_project::text,'demo:'||v_message::text,md5(v_text),
          jsonb_build_object('kind','message','text',v_text,'messageGuid','demo:'||v_message::text,'senderId','demo:'||(v_q->>'project'),
            'chatGuid','demo-offline:'||v_project::text,'direction','inbound','demo',true),'demo_fixture',v_at+interval '2 hours');
      insert into public.automation_messages(id,project_id,event_id,provider_guid,role,text,occurred_at,created_at)
        values(v_message,v_project,v_event,'demo:'||v_message::text,'requester',v_text,v_at+interval '2 hours',v_at+interval '2 hours');
      v_proof:=jsonb_build_array(jsonb_build_object('messageId',v_message,'providerGuid','demo:'||v_message::text,
        'text',v_text,'occurredAt',v_at+interval '2 hours','senderId','demo:'||(v_q->>'project'),'demo',true));
      insert into public.proposal_responses(proposal_id,revision,project_id,outcome,terms_hash,recorded_by,evidence,note,created_at)
        values(v_proposal,1,v_project,v_status,v_hash,v_owner,v_proof,'Fictional demo: owner recorded the client response against the exact proposal terms.',v_at+interval '3 hours');
      if v_status='approved' then
        select * into strict v_scope from public.scope_versions where project_id=v_project and version=1;
        v_terms:=v_scope.terms;
        v_i:=0;
        for v_line in select value from jsonb_array_elements(v_q->'lines') loop
          v_i:=v_i+1;
          v_task:=pg_temp.bridgify_demo_id(v_workspace_id,'proposal-task:'||(v_q->>'key')||':'||v_i);
          v_terms:=v_terms||jsonb_build_array(jsonb_build_object('kind','inclusion','text',(v_line->>'title')||': '||(v_line->>'acceptance_criteria'),
            'quote',v_line->>'title','proposal_id',v_proposal,'proposal_revision',1));
          insert into public.project_tasks(id,project_id,task_code,title,status,priority,assignee,origin,origin_text,
            operation,value,acceptance_criteria,source_text,source_meta,authorized_by,agreed_due_date,internal_due_date,
            proposal_id,proposal_revision,proposal_line_key,history,created_at,updated_at)
          values(v_task,v_project,'TASK-CASCADIA-'||lpad((7+v_i)::text,3,'0'),v_line->>'title',case when v_i=1 then 'in_progress' else 'ready' end,
            'high',case when v_i=1 then 'Jordan Lee' else 'Sam Rivera' end,'proposal','Client-approved proposal · revision 1',
            'project_change',v_line->>'title',v_line->>'acceptance_criteria',v_frozen,'Proposal P-'||left(v_proposal::text,8)||' · revision 1',v_owner::text,
            (select agreed_due_date from public.projects where id=v_project),(v_now at time zone 'America/Los_Angeles')::date+5,
            v_proposal,1,v_line->>'key',jsonb_build_array('Owner recorded client approval against frozen terms','Approved deliverable assigned to the implementation team'),v_at+interval '3 hours',v_now-interval '40 minutes');
          if v_i=1 then update public.automation_requests set state='accepted',task_id=v_task,updated_at=v_at+interval '3 hours' where id=v_request; end if;
        end loop;
        for v_line in select value from jsonb_array_elements(v_q->'exclusions') loop
          v_terms:=v_terms||jsonb_build_array(jsonb_build_object('kind','exclusion','text',v_line#>>'{}','quote',v_line#>>'{}','proposal_id',v_proposal,'proposal_revision',1));
        end loop;
        insert into public.scope_versions(project_id,version,document_id,terms,agreement,confirmed_by,confirmed_at)
          values(v_project,2,v_scope.document_id,v_terms,v_scope.agreement,v_owner,v_at+interval '3 hours');
        update public.projects set scope_version=2,approved_additions_cents=(v_q->>'amount')::bigint,version=2 where id=v_project;
      elsif v_status='declined' then
        update public.automation_requests set state='closed',updated_at=v_at+interval '3 hours' where id=v_request;
      end if;
      if v_status in ('approved','declined') then
        update public.owner_decisions set status='resolved',history=history||jsonb_build_array('Owner recorded the client response: '||v_status),updated_at=v_at+interval '3 hours'
          where automation_request_id=v_request;
      end if;
      insert into public.audit_events(project_id,actor_id,action,version,details,created_at)
        values(v_project,v_owner,'proposal:response:'||v_status,1,jsonb_build_object('proposalId',v_proposal,'revision',1,'reason',v_text,'demo',true),v_at+interval '3 hours');
    end if;
  end loop;
  -- Refuse to commit if a future edit accidentally introduces outbound work.
  if exists(select 1 from public.automation_outbox where project_id in (
    select pg_temp.bridgify_demo_id(v_workspace_id,'project:'||(x->>'key')) from jsonb_array_elements(v_projects) x
  )) then raise exception 'Demo fixtures must not contain outbound work.'; end if;
  insert into public.audit_events(project_id,actor_id,action,details,created_at)
    values(pg_temp.bridgify_demo_id(v_workspace_id,'project:northstar'),v_owner,'demo:seed:v1',
      jsonb_build_object('dataset','agency-demo-v1','reason','Fictional agency demo installed. No live messages sent.','projects',6),v_now);
  raise notice 'Created 6 demo projects, 37 tasks, 26 requests, 8 decisions and 6 proposals. Existing projects preserved.';
end
$demo$;

commit;
