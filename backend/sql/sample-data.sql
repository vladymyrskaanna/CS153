--
-- PostgreSQL database dump
--

\restrict bIanXIhF8KrzBAJ0xEvKSFuaAwoWaLicHcpxhjoahgmD8uUaTmdp0mDNJlOYzXA

-- Dumped from database version 17.9 (Homebrew)
-- Dumped by pg_dump version 17.9 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: distributor; Type: SCHEMA; Schema: -; Owner: evgenyarol
--

CREATE SCHEMA distributor;


ALTER SCHEMA distributor OWNER TO evgenyarol;

--
-- Name: outreach; Type: SCHEMA; Schema: -; Owner: evgenyarol
--

CREATE SCHEMA outreach;


ALTER SCHEMA outreach OWNER TO evgenyarol;

--
-- Name: research; Type: SCHEMA; Schema: -; Owner: evgenyarol
--

CREATE SCHEMA research;


ALTER SCHEMA research OWNER TO evgenyarol;

--
-- Name: ContactStatus; Type: TYPE; Schema: distributor; Owner: evgenyarol
--

CREATE TYPE distributor."ContactStatus" AS ENUM (
    'NEW',
    'CONTACTED',
    'INTERESTED',
    'QUALIFIED',
    'MEETING',
    'PROPOSAL',
    'NEGOTIATING',
    'CLOSED_WON',
    'CLOSED_LOST',
    'NOT_INTERESTED'
);


ALTER TYPE distributor."ContactStatus" OWNER TO evgenyarol;

--
-- Name: DistributorStatus; Type: TYPE; Schema: distributor; Owner: evgenyarol
--

CREATE TYPE distributor."DistributorStatus" AS ENUM (
    'NEW',
    'CALLED',
    'CALLBACK',
    'NOT_INTERESTED'
);


ALTER TYPE distributor."DistributorStatus" OWNER TO evgenyarol;

--
-- Name: PipelineStage; Type: TYPE; Schema: distributor; Owner: evgenyarol
--

CREATE TYPE distributor."PipelineStage" AS ENUM (
    'New',
    'In_Work',
    'Ready_To_Contact',
    'Contacted',
    'Replied',
    'Need_Follow_Up',
    'Demo_Booked'
);


ALTER TYPE distributor."PipelineStage" OWNER TO evgenyarol;

--
-- Name: PriorityLevel; Type: TYPE; Schema: distributor; Owner: evgenyarol
--

CREATE TYPE distributor."PriorityLevel" AS ENUM (
    'LOW',
    'HIGH',
    'MEDIUM',
    'UNKNOWN'
);


ALTER TYPE distributor."PriorityLevel" OWNER TO evgenyarol;

--
-- Name: OutreachStatus; Type: TYPE; Schema: research; Owner: evgenyarol
--

CREATE TYPE research."OutreachStatus" AS ENUM (
    'new',
    'contacted',
    'replied',
    'interested',
    'not_interested',
    'bounced'
);


ALTER TYPE research."OutreachStatus" OWNER TO evgenyarol;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Branch; Type: TABLE; Schema: distributor; Owner: evgenyarol
--

CREATE TABLE distributor."Branch" (
    id text NOT NULL,
    name text NOT NULL,
    phone text,
    website text,
    "addressLine1" text,
    "addressLine2" text,
    city text,
    state text,
    zip text,
    "addressFull" text,
    "groupId" text NOT NULL
);


ALTER TABLE distributor."Branch" OWNER TO evgenyarol;

--
-- Name: Contact; Type: TABLE; Schema: distributor; Owner: evgenyarol
--

CREATE TABLE distributor."Contact" (
    id text NOT NULL,
    "firstName" text,
    "lastName" text,
    title text,
    email text,
    seniority text,
    phone text,
    linkedin text,
    note text,
    status distributor."ContactStatus" DEFAULT 'NEW'::distributor."ContactStatus" NOT NULL,
    "lastUpdated" timestamp(3) without time zone NOT NULL,
    "lastUpdatedBy" text,
    "groupId" text NOT NULL
);


ALTER TABLE distributor."Contact" OWNER TO evgenyarol;

--
-- Name: DistributorGroup; Type: TABLE; Schema: distributor; Owner: evgenyarol
--

CREATE TABLE distributor."DistributorGroup" (
    id text NOT NULL,
    name text NOT NULL,
    phone text,
    website text,
    states text[],
    "isPriority" boolean DEFAULT false NOT NULL,
    priority distributor."PriorityLevel" DEFAULT 'UNKNOWN'::distributor."PriorityLevel" NOT NULL,
    "addressLine1" text,
    "addressLine2" text,
    city text,
    state text,
    zip text,
    "addressFull" text,
    actions text[] DEFAULT ARRAY[]::text[],
    status distributor."DistributorStatus" DEFAULT 'NEW'::distributor."DistributorStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "lastUpdated" timestamp(3) without time zone NOT NULL,
    "lastUpdatedBy" text,
    pipeline_stage distributor."PipelineStage" DEFAULT 'New'::distributor."PipelineStage" NOT NULL,
    tag text DEFAULT 'none'::text NOT NULL,
    owner_username text,
    supplier text,
    CONSTRAINT "DistributorGroup_supplier_check" CHECK (((supplier = ANY (ARRAY['molson_coors'::text, 'ab_inbev'::text, 'mixed'::text, 'independent'::text, 'none'::text])) OR (supplier IS NULL))),
    CONSTRAINT distributor_group_tag_check CHECK ((tag = ANY (ARRAY['cold'::text, 'warm'::text, 'hot'::text, 'none'::text])))
);


ALTER TABLE distributor."DistributorGroup" OWNER TO evgenyarol;

--
-- Name: DistributorNote; Type: TABLE; Schema: distributor; Owner: evgenyarol
--

CREATE TABLE distributor."DistributorNote" (
    id text NOT NULL,
    text text NOT NULL,
    "user" text NOT NULL,
    date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "distributorId" text NOT NULL
);


ALTER TABLE distributor."DistributorNote" OWNER TO evgenyarol;

--
-- Name: material; Type: TABLE; Schema: distributor; Owner: evgenyarol
--

CREATE TABLE distributor.material (
    id integer NOT NULL,
    distributor_id text NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    url text,
    filename text,
    mime_type text,
    size_bytes bigint,
    storage_path text,
    uploaded_by text NOT NULL,
    uploaded_by_name text,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT material_kind_check CHECK ((kind = ANY (ARRAY['link'::text, 'file'::text])))
);


ALTER TABLE distributor.material OWNER TO evgenyarol;

--
-- Name: material_id_seq; Type: SEQUENCE; Schema: distributor; Owner: evgenyarol
--

CREATE SEQUENCE distributor.material_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE distributor.material_id_seq OWNER TO evgenyarol;

--
-- Name: material_id_seq; Type: SEQUENCE OWNED BY; Schema: distributor; Owner: evgenyarol
--

ALTER SEQUENCE distributor.material_id_seq OWNED BY distributor.material.id;


--
-- Name: campaign; Type: TABLE; Schema: outreach; Owner: evgenyarol
--

CREATE TABLE outreach.campaign (
    id integer NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    external_provider text DEFAULT 'instantly'::text NOT NULL,
    external_id text,
    sequence_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    audience_filter_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    mailbox_ids integer[],
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    CONSTRAINT campaign_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'running'::text, 'paused'::text, 'done'::text, 'failed'::text])))
);


ALTER TABLE outreach.campaign OWNER TO evgenyarol;

--
-- Name: campaign_id_seq; Type: SEQUENCE; Schema: outreach; Owner: evgenyarol
--

CREATE SEQUENCE outreach.campaign_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE outreach.campaign_id_seq OWNER TO evgenyarol;

--
-- Name: campaign_id_seq; Type: SEQUENCE OWNED BY; Schema: outreach; Owner: evgenyarol
--

ALTER SEQUENCE outreach.campaign_id_seq OWNED BY outreach.campaign.id;


--
-- Name: campaign_lead; Type: TABLE; Schema: outreach; Owner: evgenyarol
--

CREATE TABLE outreach.campaign_lead (
    id integer NOT NULL,
    campaign_id integer NOT NULL,
    person_id integer,
    email_id integer,
    distributor_id text,
    external_lead_id text,
    status text DEFAULT 'queued'::text,
    last_event_kind text,
    last_event_at timestamp with time zone,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE outreach.campaign_lead OWNER TO evgenyarol;

--
-- Name: campaign_lead_id_seq; Type: SEQUENCE; Schema: outreach; Owner: evgenyarol
--

CREATE SEQUENCE outreach.campaign_lead_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE outreach.campaign_lead_id_seq OWNER TO evgenyarol;

--
-- Name: campaign_lead_id_seq; Type: SEQUENCE OWNED BY; Schema: outreach; Owner: evgenyarol
--

ALTER SEQUENCE outreach.campaign_lead_id_seq OWNED BY outreach.campaign_lead.id;


--
-- Name: mailbox; Type: TABLE; Schema: outreach; Owner: evgenyarol
--

CREATE TABLE outreach.mailbox (
    id integer NOT NULL,
    address text NOT NULL,
    display_name text,
    provider text DEFAULT 'instantly'::text NOT NULL,
    external_id text,
    daily_limit integer DEFAULT 50,
    warmup_active boolean DEFAULT true,
    added_by text NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE outreach.mailbox OWNER TO evgenyarol;

--
-- Name: mailbox_id_seq; Type: SEQUENCE; Schema: outreach; Owner: evgenyarol
--

CREATE SEQUENCE outreach.mailbox_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE outreach.mailbox_id_seq OWNER TO evgenyarol;

--
-- Name: mailbox_id_seq; Type: SEQUENCE OWNED BY; Schema: outreach; Owner: evgenyarol
--

ALTER SEQUENCE outreach.mailbox_id_seq OWNED BY outreach.mailbox.id;


--
-- Name: webhook_log; Type: TABLE; Schema: outreach; Owner: evgenyarol
--

CREATE TABLE outreach.webhook_log (
    id integer NOT NULL,
    provider text NOT NULL,
    event_kind text,
    signature text,
    payload jsonb NOT NULL,
    processed_at timestamp with time zone DEFAULT now() NOT NULL,
    error text
);


ALTER TABLE outreach.webhook_log OWNER TO evgenyarol;

--
-- Name: webhook_log_id_seq; Type: SEQUENCE; Schema: outreach; Owner: evgenyarol
--

CREATE SEQUENCE outreach.webhook_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE outreach.webhook_log_id_seq OWNER TO evgenyarol;

--
-- Name: webhook_log_id_seq; Type: SEQUENCE OWNED BY; Schema: outreach; Owner: evgenyarol
--

ALTER SEQUENCE outreach.webhook_log_id_seq OWNED BY outreach.webhook_log.id;


--
-- Name: article; Type: TABLE; Schema: research; Owner: evgenyarol
--

CREATE TABLE research.article (
    id integer NOT NULL,
    distributor_id text NOT NULL,
    url text,
    title text,
    outlet text,
    publication_date text,
    article_type text,
    subject_person text,
    snippet text,
    key_quote text,
    relevance real
);


ALTER TABLE research.article OWNER TO evgenyarol;

--
-- Name: article_id_seq; Type: SEQUENCE; Schema: research; Owner: evgenyarol
--

CREATE SEQUENCE research.article_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE research.article_id_seq OWNER TO evgenyarol;

--
-- Name: article_id_seq; Type: SEQUENCE OWNED BY; Schema: research; Owner: evgenyarol
--

ALTER SEQUENCE research.article_id_seq OWNED BY research.article.id;


--
-- Name: email; Type: TABLE; Schema: research; Owner: evgenyarol
--

CREATE TABLE research.email (
    id integer NOT NULL,
    distributor_id text NOT NULL,
    role text,
    to_name text,
    to_email text,
    subject text,
    body text,
    sources_md text,
    word_count integer,
    safe_mode boolean DEFAULT false,
    filename text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    body_original text,
    subject_original text,
    is_edited boolean DEFAULT false NOT NULL,
    edited_at timestamp with time zone,
    edited_by text,
    approval_status text DEFAULT 'draft'::text NOT NULL,
    approved_by text,
    approved_at timestamp with time zone,
    sent_at timestamp with time zone,
    sent_to_email text,
    sent_via text,
    sent_by text,
    sent_external_id text,
    sent_error text,
    CONSTRAINT research_email_approval_check CHECK ((approval_status = ANY (ARRAY['draft'::text, 'edited_by_human'::text, 'approved'::text])))
);


ALTER TABLE research.email OWNER TO evgenyarol;

--
-- Name: email_event; Type: TABLE; Schema: research; Owner: evgenyarol
--

CREATE TABLE research.email_event (
    id integer NOT NULL,
    email_id integer,
    person_id integer,
    kind text NOT NULL,
    payload jsonb,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_event_kind_check CHECK ((kind = ANY (ARRAY['sent'::text, 'open'::text, 'click'::text, 'reply'::text, 'bounce'::text, 'unsubscribe'::text])))
);


ALTER TABLE research.email_event OWNER TO evgenyarol;

--
-- Name: email_event_id_seq; Type: SEQUENCE; Schema: research; Owner: evgenyarol
--

CREATE SEQUENCE research.email_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE research.email_event_id_seq OWNER TO evgenyarol;

--
-- Name: email_event_id_seq; Type: SEQUENCE OWNED BY; Schema: research; Owner: evgenyarol
--

ALTER SEQUENCE research.email_event_id_seq OWNED BY research.email_event.id;


--
-- Name: email_id_seq; Type: SEQUENCE; Schema: research; Owner: evgenyarol
--

CREATE SEQUENCE research.email_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE research.email_id_seq OWNER TO evgenyarol;

--
-- Name: email_id_seq; Type: SEQUENCE OWNED BY; Schema: research; Owner: evgenyarol
--

ALTER SEQUENCE research.email_id_seq OWNED BY research.email.id;


--
-- Name: email_thread; Type: TABLE; Schema: research; Owner: evgenyarol
--

CREATE TABLE research.email_thread (
    id integer NOT NULL,
    person_id integer,
    distributor_id text,
    email_id integer,
    direction text NOT NULL,
    subject text,
    body_text text,
    body_html text,
    from_addr text,
    to_addr text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    raw_payload jsonb,
    CONSTRAINT email_thread_direction_check CHECK ((direction = ANY (ARRAY['out'::text, 'in'::text])))
);


ALTER TABLE research.email_thread OWNER TO evgenyarol;

--
-- Name: email_thread_id_seq; Type: SEQUENCE; Schema: research; Owner: evgenyarol
--

CREATE SEQUENCE research.email_thread_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE research.email_thread_id_seq OWNER TO evgenyarol;

--
-- Name: email_thread_id_seq; Type: SEQUENCE OWNED BY; Schema: research; Owner: evgenyarol
--

ALTER SEQUENCE research.email_thread_id_seq OWNED BY research.email_thread.id;


--
-- Name: fact; Type: TABLE; Schema: research; Owner: evgenyarol
--

CREATE TABLE research.fact (
    id integer NOT NULL,
    distributor_id text NOT NULL,
    fact_type text,
    subject text,
    predicate text,
    object text,
    verbatim_quote text,
    article_id integer,
    confidence real,
    validated boolean DEFAULT false
);


ALTER TABLE research.fact OWNER TO evgenyarol;

--
-- Name: fact_id_seq; Type: SEQUENCE; Schema: research; Owner: evgenyarol
--

CREATE SEQUENCE research.fact_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE research.fact_id_seq OWNER TO evgenyarol;

--
-- Name: fact_id_seq; Type: SEQUENCE OWNED BY; Schema: research; Owner: evgenyarol
--

ALTER SEQUENCE research.fact_id_seq OWNED BY research.fact.id;


--
-- Name: intel; Type: TABLE; Schema: research; Owner: evgenyarol
--

CREATE TABLE research.intel (
    distributor_id text NOT NULL,
    legal_name text,
    dba text,
    state text,
    website text,
    founded_year integer,
    employee_count integer,
    account_count integer,
    primary_supplier text,
    brands_json jsonb,
    score integer,
    tier text,
    red_flag_severity text,
    founding_moment text,
    summary text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT intel_score_check CHECK (((score IS NULL) OR ((score >= 0) AND (score <= 10))))
);


ALTER TABLE research.intel OWNER TO evgenyarol;

--
-- Name: person; Type: TABLE; Schema: research; Owner: evgenyarol
--

CREATE TABLE research.person (
    id integer NOT NULL,
    distributor_id text NOT NULL,
    full_name text NOT NULL,
    title text,
    role_category text,
    generation integer,
    is_decision_maker boolean DEFAULT false,
    is_deceased boolean DEFAULT false,
    death_year integer,
    linkedin_url text,
    email text,
    phone text,
    parent_id integer,
    spouse_id integer,
    parent_name text,
    spouse_name text,
    bio_short text,
    key_facts_json jsonb,
    photo_url text,
    education_json jsonb,
    career_summary text,
    related_article_urls jsonb,
    extra_facts_json jsonb,
    outreach_status research."OutreachStatus" DEFAULT 'new'::research."OutreachStatus" NOT NULL,
    outreach_updated_at timestamp with time zone,
    outreach_updated_by text,
    emails text[],
    phones text[],
    personal_email text,
    twitter_url text,
    github_url text,
    location_text text,
    headline text,
    experience_json jsonb
);


ALTER TABLE research.person OWNER TO evgenyarol;

--
-- Name: person_id_seq; Type: SEQUENCE; Schema: research; Owner: evgenyarol
--

CREATE SEQUENCE research.person_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE research.person_id_seq OWNER TO evgenyarol;

--
-- Name: person_id_seq; Type: SEQUENCE OWNED BY; Schema: research; Owner: evgenyarol
--

ALTER SEQUENCE research.person_id_seq OWNED BY research.person.id;


--
-- Name: red_flag; Type: TABLE; Schema: research; Owner: evgenyarol
--

CREATE TABLE research.red_flag (
    id integer NOT NULL,
    distributor_id text NOT NULL,
    flag_type text,
    severity text,
    description text,
    source_url text,
    detected_at timestamp with time zone DEFAULT now()
);


ALTER TABLE research.red_flag OWNER TO evgenyarol;

--
-- Name: red_flag_id_seq; Type: SEQUENCE; Schema: research; Owner: evgenyarol
--

CREATE SEQUENCE research.red_flag_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE research.red_flag_id_seq OWNER TO evgenyarol;

--
-- Name: red_flag_id_seq; Type: SEQUENCE OWNED BY; Schema: research; Owner: evgenyarol
--

ALTER SEQUENCE research.red_flag_id_seq OWNED BY research.red_flag.id;


--
-- Name: run; Type: TABLE; Schema: research; Owner: evgenyarol
--

CREATE TABLE research.run (
    id integer NOT NULL,
    distributor_id text,
    url text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    current_phase text DEFAULT 'queued'::text NOT NULL,
    progress_pct integer DEFAULT 0 NOT NULL,
    error text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    runtime_seconds real,
    created_by text,
    cost_usd real,
    web_searches integer,
    web_search_cost_usd real,
    llm_cost_usd real,
    input_tokens integer,
    output_tokens integer
);


ALTER TABLE research.run OWNER TO evgenyarol;

--
-- Name: run_id_seq; Type: SEQUENCE; Schema: research; Owner: evgenyarol
--

CREATE SEQUENCE research.run_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE research.run_id_seq OWNER TO evgenyarol;

--
-- Name: run_id_seq; Type: SEQUENCE OWNED BY; Schema: research; Owner: evgenyarol
--

ALTER SEQUENCE research.run_id_seq OWNED BY research.run.id;


--
-- Name: material id; Type: DEFAULT; Schema: distributor; Owner: evgenyarol
--

ALTER TABLE ONLY distributor.material ALTER COLUMN id SET DEFAULT nextval('distributor.material_id_seq'::regclass);


--
-- Name: campaign id; Type: DEFAULT; Schema: outreach; Owner: evgenyarol
--

ALTER TABLE ONLY outreach.campaign ALTER COLUMN id SET DEFAULT nextval('outreach.campaign_id_seq'::regclass);


--
-- Name: campaign_lead id; Type: DEFAULT; Schema: outreach; Owner: evgenyarol
--

ALTER TABLE ONLY outreach.campaign_lead ALTER COLUMN id SET DEFAULT nextval('outreach.campaign_lead_id_seq'::regclass);


--
-- Name: mailbox id; Type: DEFAULT; Schema: outreach; Owner: evgenyarol
--

ALTER TABLE ONLY outreach.mailbox ALTER COLUMN id SET DEFAULT nextval('outreach.mailbox_id_seq'::regclass);


--
-- Name: webhook_log id; Type: DEFAULT; Schema: outreach; Owner: evgenyarol
--

ALTER TABLE ONLY outreach.webhook_log ALTER COLUMN id SET DEFAULT nextval('outreach.webhook_log_id_seq'::regclass);


--
-- Name: article id; Type: DEFAULT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.article ALTER COLUMN id SET DEFAULT nextval('research.article_id_seq'::regclass);


--
-- Name: email id; Type: DEFAULT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.email ALTER COLUMN id SET DEFAULT nextval('research.email_id_seq'::regclass);


--
-- Name: email_event id; Type: DEFAULT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.email_event ALTER COLUMN id SET DEFAULT nextval('research.email_event_id_seq'::regclass);


--
-- Name: email_thread id; Type: DEFAULT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.email_thread ALTER COLUMN id SET DEFAULT nextval('research.email_thread_id_seq'::regclass);


--
-- Name: fact id; Type: DEFAULT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.fact ALTER COLUMN id SET DEFAULT nextval('research.fact_id_seq'::regclass);


--
-- Name: person id; Type: DEFAULT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.person ALTER COLUMN id SET DEFAULT nextval('research.person_id_seq'::regclass);


--
-- Name: red_flag id; Type: DEFAULT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.red_flag ALTER COLUMN id SET DEFAULT nextval('research.red_flag_id_seq'::regclass);


--
-- Name: run id; Type: DEFAULT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.run ALTER COLUMN id SET DEFAULT nextval('research.run_id_seq'::regclass);


--
-- Data for Name: Branch; Type: TABLE DATA; Schema: distributor; Owner: evgenyarol
--

COPY distributor."Branch" (id, name, phone, website, "addressLine1", "addressLine2", city, state, zip, "addressFull", "groupId") FROM stdin;
c18a7ad1-cc72-467d-a740-24cffc039a1b	MANHATTAN BEER DISTRIBUTORS LLC	718-292-9300	http://www.manhattanbeer.com/	400 Walnut Ave.		Bronx	NY	10454	400 Walnut Ave., Bronx, NY, 10454	f9a78f4a-c9e8-439b-9d26-13a407aec584
fe788470-8e2f-4299-8c3f-1a33c16e0e88	MANHATTAN BEER DISTRIBUTORS LLC	718-451-2100	manhattanbeer.com	5700 Ave. D		Brooklyn	NY	11203	5700 Ave. D, Brooklyn, NY, 11203	f9a78f4a-c9e8-439b-9d26-13a407aec584
84fed07e-a2f5-44f2-9eb7-7bcfc3e0df52	MANHATTAN BEER DISTRIBUTORS LLC	845-781-0111	manhattanbeer.com	114 Commerce Dr. S.		Harriman	NY	10926	114 Commerce Dr. S., Harriman, NY, 10926	f9a78f4a-c9e8-439b-9d26-13a407aec584
67aa5e57-53eb-4775-ba16-2821d18ba0ef	MANHATTAN BEER DISTRIBUTORS LLC	631-253-2100	manhattanbeer.com	2 Washington Ave.		Wyandanch	NY	11798	2 Washington Ave., Wyandanch, NY, 11798	f9a78f4a-c9e8-439b-9d26-13a407aec584
c8e576df-809e-4f1f-a934-89c196d0ba28	MANHATTAN BEER DISTRIBUTORS, LLC	718-894-3700	http://www.manhattanbeer.net/	47-47 Metropolitan Ave.		Ridgewood	NY	11385	47-47 Metropolitan Ave., Ridgewood, NY, 11385	f9a78f4a-c9e8-439b-9d26-13a407aec584
5f383254-6bfa-44c5-97e6-4c22cd0f36a4	Gulf Distributing Company of Alabama, LLC	(251) 476-9600	https://gulfdistributing.com	6990 Cross Drive, McCalla, AL 35111	\N		Al		6990 Cross Drive, McCalla, AL 35111	527c6236-4192-4b05-8715-3d11a0942b6d
b2391ddd-1f12-467a-b252-78843cc9ccd7	Gulf Distributing of Alabama	(251) 476-9600	https://gulfdistributing.com	401 N. Water St, Mobile, AL 36602	\N		Al		401 N. Water St, Mobile, AL 36602	527c6236-4192-4b05-8715-3d11a0942b6d
caf0665d-aee7-4300-a9cc-0af06e812ee2	Gulf Distributing of Alabama, LLC	(205) 251-8010	https://gulfdistributing.com/gulfdistributingofalabama/	6990 Cross Drive, McCalla, AL 35111	\N		Al		6990 Cross Drive, McCalla, AL 35111	527c6236-4192-4b05-8715-3d11a0942b6d
\.


--
-- Data for Name: Contact; Type: TABLE DATA; Schema: distributor; Owner: evgenyarol
--

COPY distributor."Contact" (id, "firstName", "lastName", title, email, seniority, phone, linkedin, note, status, "lastUpdated", "lastUpdatedBy", "groupId") FROM stdin;
\.


--
-- Data for Name: DistributorGroup; Type: TABLE DATA; Schema: distributor; Owner: evgenyarol
--

COPY distributor."DistributorGroup" (id, name, phone, website, states, "isPriority", priority, "addressLine1", "addressLine2", city, state, zip, "addressFull", actions, status, "createdAt", "updatedAt", "lastUpdated", "lastUpdatedBy", pipeline_stage, tag, owner_username, supplier) FROM stdin;
f9a78f4a-c9e8-439b-9d26-13a407aec584	MANHATTAN BEER DISTRIBUTORS LLC GROUP	718-292-9300	http://www.manhattanbeer.com/	{"New York"}	f	UNKNOWN	400 Walnut Ave.		Bronx	NY	10454	400 Walnut Ave., Bronx, NY, 10454	{}	NEW	2026-05-06 23:06:49.659	2026-05-06 23:06:49.659	2026-05-06 23:06:49.659	\N	New	none	\N	\N
687fa905-ed54-4dcb-94a7-e782c839f030	EMPIRE DISTRIBUTORS, INC.	404-874-8727	https://empiredist.com/	\N	t	HIGH	3755 Atlanta Industrial Pkwy.		Atlanta	GA	30331	3755 Atlanta Industrial Pkwy., Atlanta, GA, 30331	{}	CALLED	2026-05-06 23:06:52.645	2026-05-06 23:07:05.316	2026-05-06 23:07:05.316	Tara	New	none	\N	\N
99fd34ba-42fc-4c5d-89d6-cbf3926e013f	DOLL DISTRIBUTING INC.	(555) 9318	http://www.dolldistributing.com/	\N	f	LOW	1901 DeWolf St.		Des Moines	IA	50316	1901 DeWolf St., Des Moines, IA, 50316	{}	NEW	2026-05-06 23:06:53.855	2026-05-06 23:06:53.855	2026-06-05 01:00:52.673	admin	New	none	\N	\N
527c6236-4192-4b05-8715-3d11a0942b6d	Gulf Distributing Company of Alabama, LLC	(251) 476-9600	https://gulfdistributing.com	{AL}	f	UNKNOWN	6990 Cross Drive, McCalla, AL 35111	\N	McCalla	AL	35111	6990 Cross Drive, McCalla, AL 35111	{}	NEW	2026-05-06 23:07:02.238	2026-05-06 23:07:02.238	2026-05-06 23:07:02.238	\N	New	none	\N	\N
be559c7b-c719-4812-a69c-a5ccbfb0ece0	SARATOGA EAGLE SALES & SERVICE INC	518-792-3112	https://saratogaeagle.com	\N	t	HIGH	P.O. Box 315		Glens Falls	NY	12801	P.O. Box 315, Glens Falls, NY, 12801	{}	CALLED	2026-05-06 23:06:56.411	2026-05-06 23:07:05.659	2026-05-06 23:07:05.659	Tara	New	none	\N	\N
\.


--
-- Data for Name: DistributorNote; Type: TABLE DATA; Schema: distributor; Owner: evgenyarol
--

COPY distributor."DistributorNote" (id, text, "user", date, "distributorId") FROM stdin;
09635ae0-eaef-46f3-ae26-b19f8bdf04e9	Spoke with Darren - said they already have systems in place and are not interested - FU with email	Tara	2025-12-29 15:59:00.084	687fa905-ed54-4dcb-94a7-e782c839f030
eb44af4b-fbc5-4eb7-a1a4-95c920cba562	vm - fu email	Tara	2026-01-14 16:58:07.512	be559c7b-c719-4812-a69c-a5ccbfb0ece0
\.


--
-- Data for Name: material; Type: TABLE DATA; Schema: distributor; Owner: evgenyarol
--

COPY distributor.material (id, distributor_id, kind, title, url, filename, mime_type, size_bytes, storage_path, uploaded_by, uploaded_by_name, uploaded_at) FROM stdin;
\.


--
-- Data for Name: campaign; Type: TABLE DATA; Schema: outreach; Owner: evgenyarol
--

COPY outreach.campaign (id, name, status, external_provider, external_id, sequence_json, audience_filter_json, mailbox_ids, created_by, created_at, started_at, ended_at) FROM stdin;
\.


--
-- Data for Name: campaign_lead; Type: TABLE DATA; Schema: outreach; Owner: evgenyarol
--

COPY outreach.campaign_lead (id, campaign_id, person_id, email_id, distributor_id, external_lead_id, status, last_event_kind, last_event_at, added_at) FROM stdin;
\.


--
-- Data for Name: mailbox; Type: TABLE DATA; Schema: outreach; Owner: evgenyarol
--

COPY outreach.mailbox (id, address, display_name, provider, external_id, daily_limit, warmup_active, added_by, added_at) FROM stdin;
\.


--
-- Data for Name: webhook_log; Type: TABLE DATA; Schema: outreach; Owner: evgenyarol
--

COPY outreach.webhook_log (id, provider, event_kind, signature, payload, processed_at, error) FROM stdin;
\.


--
-- Data for Name: article; Type: TABLE DATA; Schema: research; Owner: evgenyarol
--

COPY research.article (id, distributor_id, url, title, outlet, publication_date, article_type, subject_person, snippet, key_quote, relevance) FROM stdin;
190	687fa905-ed54-4dcb-94a7-e782c839f030	https://www.prnewswire.com/news-releases/holladay-distillery--mccormick-distilling-co-announce-distribution-partnership-with-empire-distributors-inc-302693021.html	Holladay Distillery & McCormick Distilling name Empire distribution partner in three states	PR Newswire	2026-02-20	news	\N	McCormick Distilling Co. and its Holladay Distillery announced a multi-state distribution partnership with Empire across Colorado, Georgia and Tennessee, covering Holladay Bourbon, Five Farms Irish Cream, Tequila Rose, Broker's Gin, 360 Vodka and Hussong's Tequila.	\N	0.88
191	687fa905-ed54-4dcb-94a7-e782c839f030	https://www.winebusiness.com/news/article/284265	IBest Wines launches in Georgia with Empire Distributors	Wine Business	2025-03-01	news	\N	Black- and woman-owned IBest Wines debuted in Georgia through Empire on March 1, 2025, introducing a Red Blend ($38 SRP) and White Blend ($33 SRP), adding an emerging, culture-forward wine brand to Empire's Georgia book.	\N	0.88
192	687fa905-ed54-4dcb-94a7-e782c839f030	https://www.brewbound.com/pr/2025/01/16/franklin--sons-expands-us-presence-with-empire-distributors-partnership-in-georgia-and-colorado	Franklin & Sons expands U.S. presence with Empire partnership in Georgia and Colorado	Brewbound	2025-01-16	news	\N	British premium-mixer brand Franklin & Sons (est. 1886) partnered with Empire's Georgia and Colorado operations to distribute tonic water, ginger beer, ginger ale and more, citing Empire's 'exceptional reach and commitment to quality.'	\N	0.88
193	687fa905-ed54-4dcb-94a7-e782c839f030	https://empiredist.com/blogposts/sneak-peek-2024-atlanta-beverage-showcase/	Empire hosts 2024 Atlanta Beverage Showcase	Empire Distributors	2024-09-18	news	\N	Empire Distributors of Georgia held its 2024 Atlanta Beverage Showcase, connecting many of its newest brands with retail and on-premise buyers across the Atlanta market.	\N	0.88
194	687fa905-ed54-4dcb-94a7-e782c839f030	https://www.bevnet.com/spirits/2023/triple-dog-irish-whiskey-expands-distribution-in-california-colorado-and-texas	Triple Dog Irish Whiskey rolls out statewide in Colorado via Empire	BevNET	2023-08-01	news	\N	As part of an expansion into California, Colorado and Texas, Triple Dog Irish Whiskey named Empire its Colorado partner, with statewide availability beginning August 2023.	\N	0.88
195	687fa905-ed54-4dcb-94a7-e782c839f030	https://www.shankennewsdaily.com/2024/04/18/35197/top-u-s-distributors-projecting-growth-despite-challenging-conditions/	Top U.S. distributors project growth amid tough conditions	Shanken News Daily	2024-04-18	news	\N	Shanken's review of leading American wine and spirits distributors framed the competitive backdrop in which regional players like Empire compete and pursue new supplier agreements.	\N	0.88
196	687fa905-ed54-4dcb-94a7-e782c839f030	https://empiredist.com/about-us/	Empire Distributors — About Us	empiredist.com	\N	reference	\N	\N	\N	0.6
197	687fa905-ed54-4dcb-94a7-e782c839f030	https://empiredist.com/locations/	Empire Distributors — Locations	empiredist.com	\N	reference	\N	\N	\N	0.6
198	687fa905-ed54-4dcb-94a7-e782c839f030	https://www.parkstreet.com/liquor-distributors/empire-distributors/	Park Street — Empire Distributors profile	parkstreet.com	\N	reference	\N	\N	\N	0.6
199	687fa905-ed54-4dcb-94a7-e782c839f030	https://rationalwalk.com/berkshires-mclane-subsidiary-acquires-kahn-ventures/	Rational Walk — Berkshire's McLane acquires Kahn Ventures	rationalwalk.com	\N	reference	\N	\N	\N	0.6
200	687fa905-ed54-4dcb-94a7-e782c839f030	https://www.cspdailynews.com/beverages/empire-distributors-mclane-acquire-horizon-wine-sprits	CSP Daily News — Empire/McLane to acquire Horizon Wine & Spirits	cspdailynews.com	\N	reference	\N	\N	\N	0.6
201	687fa905-ed54-4dcb-94a7-e782c839f030	https://theorg.com/org/empire-distributors	The Org — Empire Distributors leadership	theorg.com	\N	reference	\N	\N	\N	0.6
117	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://www.mydigitalpublication.com/article/A+Third+Generation+Family+Business/4863971/832638/article.html	the second generation of Jeff, Mark, Tami, Scott and Jay took over in 1987 and focused on continuing to build the business and grow	mydigitalpublication.com	\N	other	\N	Storz Brewery in Omaha, NE · 1965, Merlin and his wife Edith Doll founded Doll Distributing · the second generation of Jeff, Mark, Tami, Scott and Jay took over in 1987 and focused on continuing to build the business and grow	\N	0.7
118	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://www.dolldistributing.com/about	December 23, 1965, Doll Distributing sold the Hastings distributorship and purchased Michaels Distributing in Council Bluffs, Iowa	dolldistributing.com	\N	other	\N	2,260 Anheuser-Busch cases, 33 Budweiser kegs, 355 Goetz cases, and seven tap accounts · December 23, 1965, Doll Distributing sold the Hastings distributorship and purchased Michaels Distributing in Council Bluffs, Iowa · We've been distributing the beverages you love for Three Generations	2,260 Anheuser-Busch cases, 33 Budweiser kegs, 355 Goetz cases, and seven tap accounts	0.7
119	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://www.legacy.com/us/obituaries/nonpareilonline/name/merlin-doll-obituary?id=25411913	The Daily Nonpareil / Legacy.com	Legacy.com	\N	obituary	\N	The Daily Nonpareil / Legacy.com	\N	0.7
120	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://www.dolldistributing.com/about/the-doll-team	Co-founded Doll Distributing with husband Merlin in 1965	dolldistributing.com	\N	other	\N	Co-founded Doll Distributing with husband Merlin in 1965 · Mark, Tami, Jay, and Scott · Andrew, Lauren, George and Gus	Co-founded Doll Distributing with husband Merlin in 1965	0.7
121	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://www.iowapublicradio.org/podcast/river-to-river/2025-01-08/the-struggles-and-successes-of-keeping-a-business-in-the-family	Mark and his daughter Lauren Doll-Sheeder appeared together on Iowa Public Radio's *River to River* discussing the family-business handoff	iowapublicradio.org	\N	other	\N	Mark and his daughter Lauren Doll-Sheeder appeared together on Iowa Public Radio's *River to River* discussing the family-business handoff · Iowa Public Radio — River to River · Iowa Public Radio	Mark and his daughter Lauren Doll-Sheeder appeared together on Iowa Public Radio's *River to River* discussing the family-business handoff	0.7
122	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://x.com/IowaSOS/status/2027499507173175337	Recognized by Iowa Secretary of State Paul Pate as Owner/Partner of Doll Distributing for anti-human-trafficking work	x.com	\N	other	\N	Recognized by Iowa Secretary of State Paul Pate as Owner/Partner of Doll Distributing for anti-human-trafficking work · Iowa Secretary of State (X) — "Owner/Partner of Doll Distributing" · Iowa Secretary of State on X	Recognized by Iowa Secretary of State Paul Pate as Owner/Partner of Doll Distributing for anti-human-trafficking work	0.7
123	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://www.linkedin.com/in/tami-doll-5a765620	link	LinkedIn	\N	linkedin	\N	link	\N	0.7
124	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://www.linkedin.com/in/lauren-doll-sheeder-3b977052	link	LinkedIn	\N	linkedin	\N	link	\N	0.7
125	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://www.linkedin.com/in/andrew-doll-03493931	link	LinkedIn	\N	linkedin	\N	link	\N	0.7
126	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://linkedin.com/in/gus-doll-24497613b	link	LinkedIn	\N	linkedin	\N	link	\N	0.7
127	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://www.linkedin.com/in/charles-doll-253b4016a	link	LinkedIn	\N	linkedin	\N	link	\N	0.7
128	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://www.linkedin.com/in/david-zimmerman-3a02bb34	link	LinkedIn	\N	linkedin	\N	link	\N	0.7
129	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://leadiq.com/c/doll-distributing/5a1d922a5400005b00770fde	Anheuser-Busch wholesaler relationship is highlighted as a core partnership	leadiq.com	\N	other	\N	LeadIQ · Anheuser-Busch wholesaler relationship is highlighted as a core partnership · LeadIQ partnership note	\N	0.7
130	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://www.mydigitalpublication.com/view/ankeny-area-chamber-of-commerce/ankeny-business-journal/october-business-journal-2024	Ankeny Business Journal	mydigitalpublication.com	\N	other	\N	Ankeny Business Journal	\N	0.7
131	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://www.businessrecord.com/doll-distributing-a-legacy-of-success-in-the-heart-of-iowa/	Doll Distributing: A Legacy of Success in the Heart of Iowa	businessrecord.com	\N	other	\N	Business Record · Doll Distributing: A Legacy of Success in the Heart of Iowa	\N	0.7
132	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://www.kynt1450.com/2025/12/17/conkling-distributing-sells-after-over-80-years-in-yankton/	Conkling Distributing Sells After Over 80 Years in Yankton	kynt1450.com	\N	other	\N	KYNT-AM Yankton · Conkling Distributing Sells After Over 80 Years in Yankton · KYNT-AM coverage	\N	0.7
133	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://www.kfyrtv.com/2026/01/06/mcquade-distributing-sold-new-ownership	McQuade Distributing sold to new ownership	kfyrtv.com	\N	other	\N	KFYR-TV · McQuade Distributing sold to new ownership · confirmed by KFYR-TV	\N	0.7
134	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://www.kfyrtv.com/2026/01/06/mcquade-distributing-under-new-ownership	McQuade Distributing president talks decision to sell business	kfyrtv.com	\N	other	\N	KFYR-TV · McQuade Distributing president talks decision to sell business	\N	0.7
135	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://www.yankton.net/community/article_749f809d-e190-493d-bf95-718babf3758c.html	Conkling Reflects On Lifetime In Beer Distribution, Relationships	yankton.net	\N	other	\N	Yankton Daily Press & Dakotan · Conkling Reflects On Lifetime In Beer Distribution, Relationships	\N	0.7
136	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://sos.iowa.gov/news-resources/creating-wave-change-human-trafficking-awareness-month	Creating a Wave of Change This Human Trafficking Awareness Month	sos.iowa.gov	\N	other	\N	Iowa Secretary of State · Creating a Wave of Change This Human Trafficking Awareness Month	\N	0.7
137	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://www.facebook.com/IASecretaryofState/posts/every-drop-matters-every-voice-matters-were-proud-to-congratulate-doll-distribut/1260936649185244/	recognized by SOS Paul Pate for the company's anti-trafficking advocacy	facebook.com	\N	other	\N	Iowa Secretary of State on Facebook · "Every drop matters. Every voice matters." · recognized by SOS Paul Pate for the company's anti-trafficking advocacy	\N	0.7
138	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://restaurantiowa.com/2019-40-women-to-watch/	7 accounts in 1965 to 4,000+ today	restaurantiowa.com	\N	other	\N	7 accounts in 1965 to 4,000+ today	\N	0.7
139	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://pitchbook.com/profiles/company/1190669-50	Ellwein Brothers acquired by Doll Distributing on 05-Dec-2025	pitchbook.com	\N	other	\N	Ellwein Brothers acquired by Doll Distributing on 05-Dec-2025	Ellwein Brothers acquired by Doll Distributing on 05-Dec-2025	0.7
140	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://pitchbook.com/profiles/company/146214-73	John A. Conkling Distributing Company (Yankton, SD; founded 1939) acquired on 05-Dec-2025	pitchbook.com	\N	other	\N	John A. Conkling Distributing Company (Yankton, SD; founded 1939) acquired on 05-Dec-2025	John A. Conkling Distributing Company (Yankton, SD; founded 1939) acquired on 05-Dec-2025	0.7
141	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	https://www.youtube.com/watch?v=ynbIGUdIiQ4	Iowa Businesses Against Trafficking (IBAT), an Iowa Secretary of State program supported by 550+ Iowa businesses	youtube.com	\N	other	\N	Iowa Businesses Against Trafficking (IBAT), an Iowa Secretary of State program supported by 550+ Iowa businesses	Iowa Businesses Against Trafficking (IBAT), an Iowa Secretary of State program supported by 550+ Iowa businesses	0.7
202	f9a78f4a-c9e8-439b-9d26-13a407aec584	https://hvmag.com/life-style/manhattan-beer-distributors-suffern/	Manhattan Beer debuts $80M automated Suffern facility	Hudson Valley Magazine	2024-12-01	news	\N	The distributor unveiled a modernized Hudson Valley DC built with Westfalia Technologies featuring a seven-level high-density AS/RS in a new 100,000-sq-ft addition, raising storage from ~850,000 to 1.5M+ cases with FEFO freshness picking, plus a 1-MW solar array and a 100% renewable-natural-gas fleet.	\N	0.88
203	f9a78f4a-c9e8-439b-9d26-13a407aec584	https://www.amny.com/business-finance/manhattan-beer-changes-name/	Manhattan Beer Distributors unveils new name	amNewYork	2025-01-09	news	\N	The 47-year-old company rebranded to Manhattan Beer and Beverage Distributors (MBBD) to reflect its expansion beyond beer into wine, spirits, RTDs, energy drinks, water and mixers across 14 counties.	\N	0.88
204	f9a78f4a-c9e8-439b-9d26-13a407aec584	https://www.mmh.com/article/system_report_manhattan_beer_beverage_boosts_dc_efficiency_with_high_density_as_rs_automation	System report: high-density AS/RS automation at Suffern	Modern Materials Handling	2025-02-01	news	\N	A detailed system report covers how the Westfalia-built automated storage and retrieval system boosted distribution-center efficiency, density and inventory freshness at Manhattan Beer's Suffern site.	\N	0.88
205	f9a78f4a-c9e8-439b-9d26-13a407aec584	https://www.bppulse.com/en-us/business-ev-charging/customer-stories/manhattan-beer-distributors	First East Coast buyer of Volvo VNRe electric trucks	bp pulse US	2024-06-01	news	\N	Manhattan Beer became the first East Coast customer to purchase Volvo's VNRe heavy-duty battery-electric trucks and installed 14 EV chargers at its Bronx headquarters, partnering with bp pulse on charging infrastructure.	\N	0.88
206	f9a78f4a-c9e8-439b-9d26-13a407aec584	https://www.costar.com/article/69841/manhattan-beer-distributors-buys-suffern-facility	Manhattan Beer buys Suffern facility	CoStar	2024-10-01	news	\N	The company acquired and began redeveloping its Suffern, NY property in the Hudson Valley, the site that would become its flagship automated distribution center.	\N	0.88
207	f9a78f4a-c9e8-439b-9d26-13a407aec584	https://www.manhattanbeer.com/environmental-initiatives	Manhattan Beer presents fleet transformation at ACT Expo 2025	ACT Expo	2025-04-28	news	\N	Senior director of fleet operations and sustainability Juan Corcino joined a logistics panel at the Advanced Clean Transportation Expo, detailing the company's mix of ~300 CNG trucks, electric Volvo VNRe units and on-site fueling.	\N	0.88
208	f9a78f4a-c9e8-439b-9d26-13a407aec584	https://www.crainsnewyork.com/article/20141216/HOSPITALITY_TOURISM/141219884/manhattan-beer-distributors-gulps-down-rival	Manhattan Beer Distributors gulps down rival	Crain's New York	2014-12-16	news	\N	Crain's reported Manhattan Beer's tentative deal to merge with Brooklyn-based Windmill Distributing, a combination that would give the company roughly half of NYC's beer market.	\N	0.88
209	f9a78f4a-c9e8-439b-9d26-13a407aec584	https://www.manhattanbeer.com/about	Manhattan Beer & Beverage Distributors — About	manhattanbeer.com	\N	reference	\N	\N	\N	0.6
210	f9a78f4a-c9e8-439b-9d26-13a407aec584	https://en.wikipedia.org/wiki/Manhattan_Beer_Distributors	Wikipedia — Manhattan Beer Distributors	en.wikipedia.org	\N	reference	\N	\N	\N	0.6
211	f9a78f4a-c9e8-439b-9d26-13a407aec584	https://www.crainsnewyork.com/article/20160214/SMALLBIZ/302149997/new-york-s-beer-king-simon-bergson-surveys-his-empire-built-on-coors-light-corona-and-other-brands	Crain's New York — 'New York's beer king Simon Bergson'	crainsnewyork.com	\N	reference	\N	\N	\N	0.6
212	f9a78f4a-c9e8-439b-9d26-13a407aec584	https://www.bevindustry.com/articles/89600-2016-wholesaler-of-the-year-manhattan-beer-distributors	Beverage Industry — 2016 Wholesaler of the Year	bevindustry.com	\N	reference	\N	\N	\N	0.6
213	f9a78f4a-c9e8-439b-9d26-13a407aec584	https://brooklynjewish.org/brooklyn-jewish-hall-fame-2016/simon-bergson-hof-2016-inductee/	Brooklyn Jewish Hall of Fame — Simon Bergson HOF 2016	brooklynjewish.org	\N	reference	\N	\N	\N	0.6
142	527c6236-4192-4b05-8715-3d11a0942b6d	http://nbwa.org/daily-brew/obituary-freida-gutlow-maisel/	Obituary: Freida Gutlow Maisel	NBWA Daily Brew	2023	obituary	Freida G. Maisel	A remarkable American life came to a peaceful close on Sunday evening. Freida G. Maisel, 95, died in her home in her native Mobile. Freida lived many lives in nearly a century: daughter, wife, mother, teacher and businesswoman, all with her characteristic intelligence, charm, elegance and beauty. In 1973, Freida bought a small beverage wholesaler in Mobile, renamed it Gulf Distributing Company, and built the foundation of a business that now serves customers in six states and employs nearly 2,000 people. Freida became a member of the Committee of 200, a national organization of prominent businesswomen. She broke new ground and glass ceilings, all with a steel backbone wrapped in charm. Freida retired at the age of 70 and handed Gulf over to her son Elliot but she remained interested in and apprised of the business until her final days. In 2009, Frieda was honored with NBWA's Life Service Award. And just last year, NBWA announced the establishment of the Freida G. Maisel Trailblazer Award.	She broke new ground and glass ceilings, all with a steel backbone wrapped in charm.	0.98
143	527c6236-4192-4b05-8715-3d11a0942b6d	https://obits.al.com/us/obituaries/mobile/name/freida-maisel-obituary?id=48741491	Freida Maisel Obituary (1928 - 2023) - Mobile, AL	AL.com / Mobile Press-Register	2023-02-28	obituary	Freida G. Maisel	Betsy (Mary Elizabeth) Rambeau, April 20, 2023: Am sorry this is so late. I knew Freida at Murphy High School. We were in the same class of 1945. I saw her off and on thru the years and really enjoyed knowing her. Karen Pitts, March 8, 2023: Frieda and I were in Committee of 200 together. She was a friend and leader. Always had a kind word and went out of her way to welcome me to C200 when I first joined. Reggie Copeland Sr, March 1, 2023: Mobile has lost a great friend and lady who was committed to making our city a wonderful place to work, live and play! Cindy McCord, March 1, 2023: I am so sorry to hear of her passing. I worked for her for many years at GDC and always knew her as a pleasant and caring woman. Memorial Events: Feb 28, Graveside service, 1:00 p.m., Congregation Ahavas Chesed Cemetery.	She lived the definition of LADY! My best friend in Committee of 200.	0.92
144	527c6236-4192-4b05-8715-3d11a0942b6d	https://thebusinessview.com/gulf-distributing-companys-50-year-legacy-elliot-maisel-takes-a-look-back-and-ahead/	Gulf Distributing Company's 50-Year Legacy: Elliot Maisel Takes a Look Back and Ahead	The Business View (Mobile Chamber)	2024	press_release	Elliot B. Maisel	Gulf Distributing Company was established on December 19, 1973, by Freida G. Maisel, a Mobile native born into an immigrant family. Her mother was from Lithuania and her father was from the border between Poland and Russia. After working as a school teacher for 25 years, she bought the assets of what had once been Jax Distributing Company. The company had been in business since 1935 and at the time had 15 employees and four trucks. His father, Herman Maisel, was the one who initially found the opportunity to buy Jax Distributing Company. 'My father was a dynamo. We wouldn't have Gulf if it wasn't for him. He had vision and he had courage. In our family story, it is well-known that he wanted to buy it. In Alabama and in most states, you cannot be a wholesaler and a retailer. He was a retailer. So, my mother bought the company and for that we are very thankful,' Maisel said with a smile.	I trademarked an expression many years ago: there's north Alabama, south Alabama and the great state of Mobile.	0.97
145	527c6236-4192-4b05-8715-3d11a0942b6d	https://baybusinessnews.com/articles/elliot-maisel-chairman-ceo-gulf-distributing/	Elliot Maisel: Chairman & CEO, Gulf Distributing	Bay Business News	2025	industry_press	Elliot B. Maisel	Gulf Distributing was founded in 1973 and has been in the hands of the Maisel family ever since. Chairman and CEO Elliot Maisel has been involved since the beginning, first helping his mother, Freida Maisel, and then taking the reins in the early 1990s. In October 2025, Gulf moved into a new, expanded headquarters in downtown Mobile, building on the success of the last 50-plus years and providing a space that can support company growth. After graduating, I moved back to Mobile in 1974 and worked at both Gulf Distributing and Herman Maisel and Company. In the 1980s, I bought and operated the Hamrick Motor Company auto dealerships and later worked on pari-mutuel racing development projects before selling those interests in 1990. After that, I focused my attention fully on Gulf Distributing.	My mother founded Gulf Distributing after a 30-year career teaching middle school English. At the time she started the company, she was recognized as the first woman to purchase a beer distributorship outright and one of a very few wholly woman-owned beer distributors in the U.S.	0.97
146	527c6236-4192-4b05-8715-3d11a0942b6d	https://www.al.com/news/2025/01/thc-infused-beverages-mobile-mayoral-race-qa-with-beer-distributor-elliot-maisel.html	THC-infused beverages, Mobile mayoral race: Q&A with beer distributor Elliot Maisel	AL.com	2025-01	newspaper	Elliot B. Maisel	Elliot Maisel is not only shepherding the move of the city's airport closer to downtown Mobile. He's also organizing a once-in-a-lifetime move of Gulf Distributing, his 51-year-old, family-owned business, to downtown. 'It's about pride in the city, and maybe it will encourage others to move their businesses downtown or locate their businesses in the city,' said Maisel, the president & CEO of the business that was officially founded in 1973, by his late mother, Frieda Maisel, a former teacher. The company will relocate next year into the former Mobile Press-Register building at 401 N. Water St. Maisel, chairman emeritus of the Mobile Airport Authority, is busy overseeing the transition from Gulf Distributing's longtime headquarters on Moffett Road to downtown Mobile, while also seeking funding for the eventual opening of a five-gate commercial aviation terminal at the Mobile Aeroplex at Brookley.	It's about pride in the city, and maybe it will encourage others to move their businesses downtown or locate their businesses in the city.	0.94
147	527c6236-4192-4b05-8715-3d11a0942b6d	https://www.al.com/business/2013/08/mobile_entrepreneur_smoking_th.html	Mobile entrepreneur smoking the competition with newest venture	AL.com	2013-08	newspaper	Elliot B. Maisel	MOBILE, Alabama – Two years after acquiring a fledgling electronic cigarette company, Mobile's Elliot Maisel sits poised to parlay a lifetime of distribution expertise into his share of a projected $1 billion market. 'I've been building brands all my life as a distributor, and what we've done here is take beer branding to the cigarette market,' said Maisel, chairman and chief executive officer of both Gulf Distributing Holdings LLC and FIN Branding Group LLC. FIN was actually co-founded several years ago by serial entrepreneurs Josh Shapiro and David Stone as FINITI when vapor-based alternatives to traditional cigarettes were first gaining national attention. Maisel joined the conversation in February 2011. 'A mutual friend of ours told me there were two young guys manufacturing these electronic cigarettes, and they thought they might sell them in bars, so they wanted a beer distributor to set up prototype distribution,' said Maisel.	I've been building brands all my life as a distributor, and what we've done here is take beer branding to the cigarette market.	0.78
148	527c6236-4192-4b05-8715-3d11a0942b6d	https://www.brewbound.com/news/nbwa-board-chair-rebecca-maisel-lets-go-back-to-basics/	NBWA Board Chair Rebecca Maisel: 'Let's Go Back to Basics'	Brewbound	2024-10	industry_press	Rebecca L. Maisel	Gulf Distributing SVP Rebecca Maisel made a rallying cry for beer distributors to get energized and invest in their businesses during her first speech as National Beer Wholesalers Association (NBWA) chair on Tuesday at the trade group's annual gathering. About 1,700 industry members attended the 87th Annual Convention, with the Product Showcase housing 150 booths. Included in the three-day event's activities was the transition of power from outgoing NBWA board chair and Fabiano Brothers CEO Jim Fabiano II, to Maisel. Maisel previously served as chair of the NBWA's Next Generation Group and chair of the Alabama Wholesale Beer Association, and spent eight years on the NBWA's Management Committee.	Having this board elect me to the officer corps of NBWA three years ago, running the chairs and standing here today as your chair, sends a message to our membership and to the beverage world that there is room at the very top of this industry for qualified emerging leaders who demonstrate passion and commitment to our mission.	0.97
149	527c6236-4192-4b05-8715-3d11a0942b6d	https://thebusinessview.com/gulf-distributings-rebecca-maisel-named-chair-of-national-beer-wholesalers-association/	Gulf Distributing's Rebecca Maisel Named Chair of National Beer Wholesalers Association	The Business View (Mobile Chamber)	2024-10	press_release	Rebecca L. Maisel	MOBILE, Ala. – Gulf Distributing is pleased to announce that Senior Vice President of Legal and Government Affairs, Rebecca Maisel, will serve as the National Beer Wholesalers Association (NBWA) Chair of the Board. The appointment was announced on the main stage at NBWA's 87th Annual Convention and Product Showcase in San Diego on October 1, 2024. Maisel, who has served on the NBWA board for nine years, was previously the chair of NBWA's Next Generation Group, bringing together emerging leaders in the beer distribution industry. As the Senior Vice President of Legal and Government Affairs at Gulf Distributing, she represents a third-generation family business based in Mobile, Alabama serving customers in Alabama, Florida and Mississippi.	My grandmother, Freida Maisel, founded Gulf Distributing back in 1973, and I always knew I wanted to be a beer distributor and part of our family business. I am proud to take my family's legacy of serving our industry to a national stage.	0.95
150	527c6236-4192-4b05-8715-3d11a0942b6d	https://nbwa.org/press-release/brewed-for-this-moment-brew-leadership-forum-delivers-star-power-and-timely-lessons/	BREWed for This Moment: BREW Leadership Forum Delivers Star Power and Timely Lessons	NBWA	2026-04	press_release	Rebecca L. Maisel	'What I love about looking around this room is that it reflects the workforce we're building — leaders from across roles, generations and perspectives who are invested in getting better together,' said Rebecca Maisel, Gulf Distributing Holdings Chief Corporate Strategy Officer, BREW Advisory Board Member and Immediate Past Chair of NBWA. 'The decades of experience and leadership in this room are essential as the industry continues to evolve.' Maisel helped bring the day's themes to life during a powerhouse opening panel on multi-generational leadership, joining her father Elliot Maisel and two other father-daughter distributor leadership teams: Lauren Doll-Sheeder and Mark Doll (Doll Distributing) and Sarah Matesich and Jim Matesich (Matesich Distributing).	What I love about looking around this room is that it reflects the workforce we're building — leaders from across roles, generations and perspectives who are invested in getting better together.	0.9
151	527c6236-4192-4b05-8715-3d11a0942b6d	https://thebusinessview.com/freida-maisel-honored-posthumously-with-inaugural-freida-g-maisel-businesswoman-of-the-year-award/	Freida Maisel Honored Posthumously with Inaugural Freida G. Maisel Businesswoman of the Year Award	The Business View (Mobile Chamber)	2024	press_release	Freida G. Maisel	MOBILE, Ala. – More than 700 business leaders attended the Mobile Chamber's 187th Annual Meeting presented by BankPlus, held at the Mobile Cruise Terminal Thursday night. The Mobile Chamber also introduced the Inaugural Freida G. Maisel Businesswoman of the Year Award, a new annual accolade honoring women who exhibit exemplary leadership and community impact. Named in honor of Freida Maisel, a pioneering businesswoman who revolutionized the beverage industry and shattered barriers with grace and determination, this award celebrates the legacy of female leadership and entrepreneurship. In a poignant tribute, the inaugural Freida G. Maisel Businesswoman of the Year Award was posthumously presented to its namesake, Freida Maisel, with her son, Elliot Maisel, accepting the honor on her behalf.	We are privileged to inaugurate the Freida G. Maisel Businesswoman of the Year Award and pay homage to Mrs. Maisel's enduring legacy. Her remarkable achievements serve as a beacon of inspiration for aspiring businesswomen everywhere.	0.88
152	527c6236-4192-4b05-8715-3d11a0942b6d	https://beernet.com/bbd/bbd-article/the-floribama-beer-king-quietly-strikes-a-deal/	The Floribama Beer King Quietly Strikes a Deal	Beer Business Daily	\N	industry_press	Elliot B. Maisel	Dear Client: The Floribama Beer King, which is what I call Elliot Maisel, much to his dismay I'm sure, and his Gulf Distributing, a Blue/Silver house in Alabama, has a deal to acquire the remaining distribution assets of the Schilleci family's Birmingham-based distributorship, Supreme Beverage -- but with a twist. Members of the Schilleci family will take stock in Gulf, making it a merger of sorts. SIDEBAR: Recall that Elliot also has a separate Florida panhandle distributorship which he owns.	The Floribama Beer King, which is what I call Elliot Maisel, much to his dismay I'm sure.	0.85
153	527c6236-4192-4b05-8715-3d11a0942b6d	https://beernet.com/bbd/bbd-article/were-never-done-chasing-rebecca-maisel-on-gulfs-playbook/	"We're Never Done Chasing": Rebecca Maisel on Gulf's Playbook	Beer Business Daily	\N	industry_press	Rebecca L. Maisel	Dear Client: Gulf Distributing has more than 100 suppliers, led by Molson Coors, Constellation, and Boston Beer — with big growers like Surfside, Garage Beer, Red Bull, and even some hemp THC rounding things out. With locations across Alabama, Mississippi, and Florida, Gulf was pegged by the Wall Street Journal at roughly $750 million in gross revenue per year. Is this the perfect portfolio? What else are they chasing? We asked Gulf Distributing's Chief Corporate Strategy Officer, Rebecca Maisel, who...	We're Never Done Chasing	0.9
154	527c6236-4192-4b05-8715-3d11a0942b6d	https://www.southalabama.edu/departments/publicrelations/pressreleases/030926daa.html	Celebrating Alumni Excellence and Community Impact	University of South Alabama	2026-03-06	alumni_magazine	Elliot B. Maisel	Elliot B. Maisel, chairman and CEO of Gulf Distributing Holdings LLC, was honored for his leadership in business and civic engagement. A Mobile native, Maisel began his career working in his mother's beverage distribution company and his father's real estate firm. Today he leads Gulf Distributing Holdings, which employs more than 1,300 people across Alabama, Florida and Mississippi and represents more than 120 beverage suppliers. Maisel has served on numerous civic and philanthropic boards and is chairman emeritus of the Mobile Airport Authority. In 2024, he made a transformational gift supporting a new education and research building for the Whiddon College of Medicine. His industry leadership has also been widely recognized, including being named a MolsonCoors Legend in 2023, the company's highest honor for distributor partners.	In 2024, he made a transformational gift supporting a new education and research building for the Whiddon College of Medicine.	0.88
155	527c6236-4192-4b05-8715-3d11a0942b6d	https://www.casemine.com/judgement/us/5b765f968b09d30aefc3c3ec	Hector v. Gulf Distrib. Co. of Mobile, LLC	CaseMine / S.D. Ala.	2018	court_record	\N	Plaintiff, Jawarren Hector, by and through counsel, brought this action against his former employer, Gulf Distributing Company of Mobile, LLC. Hector contended that Gulf Distributing violated the Fair Labor Standards Act, 29 U.S.C. §§ 201 et seq. ('FLSA'), by failing to pay him overtime compensation as required by the statute. In particular, Hector alleged that he was employed as a 'Driver Helper' whose primary duty involved unloading Gulf Distributing's product from delivery vehicles at defendant's customers' locations. Hector 'was not paid at a rate of one and a half times [his] regular rate for hours worked in excess of forty (40) in a workweek,' even though he 'was a non-exempt employee.' Against this backdrop of litigation uncertainty, the parties negotiated a settlement to resolve these FLSA claims in their entirety.	\N	0.55
156	527c6236-4192-4b05-8715-3d11a0942b6d	https://www.brewbound.com/pr/2026/03/06/gulf-distributing-holdings-selects-ohanafy-to-lead-enterprise-technology-transformation	Gulf Distributing Holdings Selects Ohanafy to Lead Enterprise Technology Transformation	Brewbound	2026-03-06	press_release	Elliot B. Maisel	MOBILE, AL — Gulf Distributing Holdings, LLC, a premier beverage wholesaler with more than 50 years of market leadership, and Ohanafy, the AI-powered operating platform built exclusively for the beverage industry, today announced a strategic partnership to modernize Gulf's enterprise technology infrastructure. Together, the two organizations will lead a comprehensive, company-wide transformation of Gulf's operating systems, bringing real-time visibility, greater agility, and enhanced connectivity across sales, operations, finance, and leadership. Through this partnership, Gulf will deploy Ohanafy's comprehensive enterprise suite across its operations. By consolidating core functions into one connected platform, the company will automate warehouse and truck-building workflows, optimize routing, enable intelligent suggested ordering, and gain real-time visibility across the organization.	This investment reflects our commitment to our mission of being future-focused. Modernizing our technology infrastructure is a commitment not only to our employees' efficiency and quality of life, but it also ensures we remain a relevant strategic partner for our suppliers and a reliable resource for our retail customers for decades to come.	0.85
157	527c6236-4192-4b05-8715-3d11a0942b6d	https://mobilechamber.com/2023/01/gulf-distributing-to-relocate-operations-to-downtown-mobile/	Gulf Distributing to Relocate Operations to Downtown Mobile	Mobile Chamber	2023-01	press_release	Elliot B. Maisel	Gulf Distributing Co. of Mobile is a subsidiary of Gulf Distributing Holdings, LLC. Gulf Distributing Holdings was founded in Mobile, AL, in 1973 by Freida Maisel. Family-driven for fifty years, Gulf Distributing Holdings currently operates several distribution companies that service the entire state of Alabama, two regional areas in Mississippi, and the Florida panhandle. 'When Gulf was founded in 1973, my mother and I had about 15 employees and a few trucks. The Moffett Road location was a perfect fit for Gulf back then and had plenty of room for our thriving business to grow. Now almost fifty years later, Gulf's business is bursting at the seams, and we need more space for all the growth Gulf has achieved,' said Gulf Distributing Chairman and CEO Elliot B. Maisel. 'After a lengthy search, we are thrilled to have found the old Press Register location on Water Street.'	When Gulf was founded in 1973, my mother and I had about 15 employees and a few trucks. The Moffett Road location was a perfect fit for Gulf back then and had plenty of room for our thriving business to grow.	0.86
158	527c6236-4192-4b05-8715-3d11a0942b6d	https://www.linkedin.com/in/elliot-maisel-92b538a	link	LinkedIn	\N	linkedin	\N	link	\N	0.7
159	527c6236-4192-4b05-8715-3d11a0942b6d	https://www.linkedin.com/in/rmaisel	link	LinkedIn	\N	linkedin	\N	link	\N	0.7
160	527c6236-4192-4b05-8715-3d11a0942b6d	https://www.linkedin.com/in/louis-maisel-836bba35	link	LinkedIn	\N	linkedin	\N	link	\N	0.7
161	527c6236-4192-4b05-8715-3d11a0942b6d	https://www.linkedin.com/in/jimmy-marston-b0288717	link	LinkedIn	\N	linkedin	\N	link	\N	0.7
162	527c6236-4192-4b05-8715-3d11a0942b6d	https://linkedin.com/in/james-cox-6864b094	link	LinkedIn	\N	linkedin	\N	link	\N	0.7
163	527c6236-4192-4b05-8715-3d11a0942b6d	https://www.linkedin.com/in/jeff-floyd-b5b15044	link	LinkedIn	\N	linkedin	\N	link	\N	0.7
164	527c6236-4192-4b05-8715-3d11a0942b6d	https://www.linkedin.com/in/domenic-olson-702aa053	link	LinkedIn	\N	linkedin	\N	link	\N	0.7
165	527c6236-4192-4b05-8715-3d11a0942b6d	https://www.linkedin.com/in/joey-irelan-05908165	link	LinkedIn	\N	linkedin	\N	link	\N	0.7
55	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://www.hws.edu/alum/pssSpring21/vukelic.aspx	Jeff Vukelic '88: What Would Dad Do?	Pulteney Street Survey (Hobart and William Smith Colleges Alumni Magazine)	2021	alumni_magazine	Jeff Vukelic	Now, steering the fourth-generation, family-owned beverage company through the pandemic, he reflects on the key lessons that have guided the business in safety, success and good spirits. REFLECTIVE LEADERSHIP: "If you talk to most leaders, they surround themselves with people who are smarter than they are," says Vukelic, who is "always looking to get better through education and learning from others." A lifelong "student of leadership," he turns to his business coach, his peers, his employees and the examples his father and grandfather set as they guided the company through the Great Depression, World War II and the beverage industry's evolution during the 20th century.	During COVID, we were happy to have people working, but we have to keep our stakeholders healthy — that's first and foremost.	0.98
56	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://www.amigone.com/obituaries/Eugene-P-Gene-Vukelic?obId=43830417	Eugene P. "Gene" Vukelic Obituary	Amigone Funeral Home	2025-08	obituary	Eugene P. "Gene" Vukelic	Eugene P. "Gene" Vukelic, Chairman of Try-It Distributing and Philanthropic Business Leader, Dies at 94. December 29, 1930 – August 3, 2025.	\N	0.95
57	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://www.bizjournals.com/buffalo/news/2025/08/05/gene-vukelic-dies-try-it-distributing-chairman.html	Try-It Distributing Chairman Gene Vukelic dies at 94	Buffalo Business First	2025-08-05	newspaper	Eugene P. "Gene" Vukelic	Gene Vukelic, chairman of Try-It Distributing, died at 94. He turned his father's bootleg beer business into a multi-million-dollar company.	\N	0.9
58	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://www.buffalorising.com/2025/08/heaven-gains-a-buffalo-icon-in-business-philanthropy-and-family-in-try-it-distributing-chairman-eugene-p-gene-vukelik/	Heaven Gains a Buffalo Icon in Business, Philanthropy and Family in Try-It Distributing Chairman Eugene P. "Gene" Vukelic	Buffalo Rising	2025-08	newspaper	Eugene P. "Gene" Vukelic	He was Chairman of Try-It Distributing which supplied the ballpark with its Anheuser-Busch and Labatt brands of beer and from my first visit, he was the epitome of a gentleman, a legacy he carried throughout his storied career. He carried that passion throughout his life and when Buffalo's "Baby Joe" Mesi emerged on the scene as a heavyweight professional contender, Gene was right there to support him financially and as a mentor. For Gene, the legacy of family was not only a testament to his life's work but the true measure of his success—a blessing he treasured above all.	For Gene, the legacy of family was not only a testament to his life's work but the true measure of his success—a blessing he treasured above all.	0.92
59	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://www.buffalospree.com/features/the-beerfather-gene-vukelic/article_4d66a417-901b-52bd-b388-35014533ad7e.html	The Beerfather: Gene Vukelic	Buffalo Spree	\N	newspaper	Gene Vukelic	How did Try-It manage to become one of three major beer distributors in Buffalo when, back in 1960 when Gene Vukelic joined his father in [the business]... In 2004 son Paul Vukelic, president and COO, formed a subsidiary, Balkan Beverage, to distribute soft drinks like Red Bull, Arizona Tea, and others.	\N	0.85
60	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://buffalonews.com/news/article_1ea27b1c-fa69-50eb-9d41-bece5824ceee.html	Stephen G. Vukelic, partner in Try-It Distributing Co.; Oct. 27, 1927 -- March 25, 2010	Buffalo News	2010-03	obituary	Stephen G. Vukelic	Vukelic, a partner in Try-It Distributing Co. and a longtime resident of Hamburg, died March 25 in his Sebring, Fla., home. Mr. Vukelic was a graduate of Manlius Military Academy and was a member of the football team at each school. He also was a Marine Corps veteran.	\N	0.78
61	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://www.saratoga.com/saratogabusinessjournal/2022/01/saratoga-eagle-expands-by-acquiring-distributorships-in-oneonta-and-elmira/	Saratoga Eagle Expands By Acquiring Distributorships In Oneonta And Elmira	Saratoga Business Journal	2022-01	newspaper	Jeff Vukelic	Saratoga Eagle Sales & Service is in the process of acquiring two companies that will expand its reach distributing beer, wine, soft drinks and water to an additional eight counties upstate, according to president and chief operating officer Jeff Vukelic. With roots stretching back to Buffalo in 1928 with parent company Try-It Distributing, what started as a beverage bottling business by the late Stephen Vukelic is now a multi-generational family company. According to Vukelic, the new acquisitions are Northern Eagle Beverages Inc. out of Oneonta and Seneca Beverage Corp. This is the time frame when Try-It expanded into the Saratoga and Glens Falls areas with a new distribution hub subsidiary out of Saratoga Springs and grandson Jeff Vukelic took on the role of COO.	\N	0.95
62	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://www.saratoga.com/saratogabusinessjournal/2020/02/saratoga-eagles-sales-and-service-growth-leads-to-plans-to-expand-its-warehouse/	Saratoga Eagle's Sales And Service Growth Leads To Plans To Expand Its Warehouse	Saratoga Business Journal	2020-02	newspaper	Jeff Vukelic	Jeff Vukelic, president and chief executive officer, Saratoga Eagle Sales and Service, says the company is expanding its local warehouse as business continues to grow for the company. After years of growth, Saratoga Eagle Sales and Service is expanding its Saratoga warehouse. According to Jeff Vukelic, president and chief executive officer, the success of Saratoga Eagle Sales and Service is due to their ability to adapt to changing consumer demands: "As a company, we've had success in reducing costs and operating more efficiently over the past couple years." Try-It Distributing, the parent company of Saratoga Eagle Sales and Service, was founded in 1928. In 2005, Jeff Vukelic took over as president and chief executive officer.	As a company, we've had success in reducing costs and operating more efficiently over the past couple years.	0.9
63	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://www.saratogian.com/2010/05/17/saratoga-eagle-formally-completes-purchase-of-ruch-widens-market/	Saratoga Eagle formally completes purchase of Ruch, widens market	The Saratogian	2010-05-17	newspaper	Jeff Vukelic	SARATOGA SPRINGS – Saratoga Eagle Sales & Service has formally completed its purchase of Ruch Distributors Inc. of Albany. The acquisition virtually doubles Saratoga Eagle's market to include all of Albany and Rensselaer counties. "We're excited." Thirty-four of Ruch's 51 employees will be hired by Saratoga Eagle in all areas, from sales and marketing to delivery personnel. "Our two organizations have a great deal in common, and this acquisition will not have a dramatic impact on the Ruch employees or customers other than a new name and logo," Vukelic said.	Our two organizations have a great deal in common, and this acquisition will not have a dramatic impact on the Ruch employees or customers other than a new name and logo.	0.85
64	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://www.glensfallschronicle.com/saratoga-eagle-buys-minogues-beverage-biz-key-2-families-succession/	Saratoga Eagle buys Minogue's beverage biz; Key 2 families: succession	Glens Falls Chronicle	2021-11	newspaper	Jeff Vukelic	Jeff Vukelic, CEO of Saratoga Eagle, and his brother Paul, who heads the family's Try-It Beverage Distributor out of Buffalo, purchased Minogue's Beverage Centers. Jeff Vukelic and his brother Paul purchased 100-year-old Minogue's Beverage Centers last week from Jack Minogue. "We are a fourth generation family-owned business with locations in Western and Eastern New York, built on the core values of 'Will to Win, Trust, Doing the Right Thing, and Fun'," says Jeff. Paul is CEO of Try-It. Jeff moved to the Capital Region in the early 2000's when they acquired Northern Distributing.	We are a fourth generation family-owned business with locations in Western and Eastern New York, built on the core values of 'Will to Win, Trust, Doing the Right Thing, and Fun'.	0.95
65	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://www.dailygazette.com/news/saratoga-eagle-acquires-minogue-s-beverage-center/article_322a241f-4fb9-5531-8a26-37c0d77d9b41.html	Saratoga Eagle acquires Minogue's Beverage Center	The Daily Gazette	2021-11	newspaper	Jeff Vukelic	President John "Jack" Minogue Jr. stands in his Saratoga Springs store on West Avenue holding a photo of his grandfather's M.T. Minogue beer truck with Dobler beer and ale painted on it. The owners of Saratoga Eagle completed the acquisition of Minogue's Beverage Center on Monday. The two formed a new subsidiary of Saratoga Eagle — Pivo Partners — to acquire Minogue's Beverage Center. The brothers need to strike a balance, Jeff Vukelic explained, because Saratoga Eagle will continue to supply competitors to the Minogue Beverage Centers and the Minogue Beverages Centers will continue to buy some of their inventory from DeCrescente Distributing in Mechanicville, which is Saratoga Eagle's biggest competitor.	\N	0.85
66	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://www.bizjournals.com/albany/news/2022/01/19/saratoga-eagle-up-and-running-after-fire.html	Saratoga Eagle back in operation following Christmas Day fire	Albany Business Review	2022-01-19	newspaper	Saratoga Eagle Sales & Service	The company acquired four Minogue's Beverage Centers in Saratoga and Warren counties in November before completing the purchase of Seneca Beverage. Saratoga Eagle back in operation following Christmas Day fire.	\N	0.7
67	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://www.saratoga.com/saratogabusinessjournal/2019/03/saratoga-eagle-sales-adds-a-distributorship/	Saratoga Eagle Sales Adds A Distributorship	Saratoga Business Journal	2019-03	newspaper	Jeff Vukelic	Saratoga Springs-based Saratoga Eagle Sales & Service is acquiring family owned Plattsburgh Distributing, a distributor of Budweiser, Rolling Rock and energy drinks in the North Country. "It's a great opportunity to grow our business," Saratoga Eagle president Jeff Vukelic said. "It's a family owned business, and we felt a lot of synergy there." Saratoga Eagle Sales & Service is also a family owned and operated business founded in 1933. The company operates out of a 150,000-square-foot facility at 45 Duplainville Road, Saratoga Springs, delivering five million cases of craft beers, domestic and imported alcoholic beverages, wine and spirits, energy drinks to over 2,500 customers.	It's a great opportunity to grow our business. It's a family owned business, and we felt a lot of synergy there.	0.88
68	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://www.facebook.com/OleanNYChamber/posts/938607411642066/	Welcome to the Chamber New Member, Try-It Distributing!	Greater Olean Area Chamber of Commerce	\N	company_about	Stephen L. Vukelic	Vukelic started bottling soft drinks in his native Lackawanna, New York in 1928, at age 27, to meet the demand of thirsty Western New Yorkers during prohibition. When Try-It added Budweiser and Michelob to its product list in 1946 and Labatt in 1949, Stephen, fondly known as "The Chief," had charted the course for the company's successful future. In 2005, the family acquired another Anheuser-Busch distributorship, Saratoga Eagle Sales & Service in Glens Falls, NY. In October 2013, Try-It Wine & Spirits was formed to distribute wine and liquor to Erie and Niagara Counties. In 2023, the family acquired another Anheuser-Busch distributorship, Sanzo Beverage in Olean, NY.	Stephen, fondly known as 'The Chief,' had charted the course for the company's successful future.	0.82
69	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://www.pacermonitor.com/public/case/60580793/Pitta_v_Saratoga_Eagle_Sales__Service_Inc	Pitta v. Saratoga Eagle Sales & Service Inc. (3:25-ap-02203)	PACER / New Jersey Bankruptcy Court	2025-10-12	court_record	Saratoga Eagle Sales & Service Inc.	Adversary case 25-02203 Complaint by Thomas A. Pitta against Saratoga Eagle Sales & Service Inc.. Fee Amount $ 350.. (12 (Recovery of money/property - 547 preference)) filed by Plaintiff Thomas A. Pitta. Summons Issued to Thomas A. Pitta, as Trustee of the RAD Sub-Trust A for Service on Saratoga Eagle Sales & Service Inc. Answer due on 11/14/2025 Pre-Trial hearing to be held on 12/22/2025 at 11:00 AM at MBK - Courtroom 8, Trenton.	\N	0.55
70	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://www.linkedin.com/in/jeff-vukelic-79482811	link	LinkedIn	\N	linkedin	\N	link	\N	0.7
71	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://www.linkedin.com/in/paul-vukelic-68618112	link	LinkedIn	\N	linkedin	\N	link	\N	0.7
72	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://www.linkedin.com/in/ej-harkins-b4304923	link	LinkedIn	\N	linkedin	\N	link	\N	0.7
\.


--
-- Data for Name: email; Type: TABLE DATA; Schema: research; Owner: evgenyarol
--

COPY research.email (id, distributor_id, role, to_name, to_email, subject, body, sources_md, word_count, safe_mode, filename, created_at, body_original, subject_original, is_edited, edited_at, edited_by, approval_status, approved_by, approved_at, sent_at, sent_to_email, sent_via, sent_by, sent_external_id, sent_error) FROM stdin;
23	527c6236-4192-4b05-8715-3d11a0942b6d	heir	Evan B. Maisel	\N	From Freida's four trucks to Evan's SVP seat	Your grandmother Freida bought Jax Distributing in 1973 with 15 employees and four trucks after 25 years teaching school; your father Elliot moved back to Mobile in 1974 to build it with her and was named a Molson Coors Legend in 2023 for the half-century that followed. As SVP, you're stepping into that chair just as Gulf — now 1,300+ people across three states with 120+ suppliers — has signed Ohanafy's AI platform to modernize the entire enterprise.\n\nThat's a third-generation handoff happening at exactly the moment the operating model is being rewritten — and where the next generation gets to define what "future-focused" actually looks like in the field. Your father framed the Ohanafy decision as a commitment to being future-focused for employees, suppliers, and retailers for decades to come; that's the standard the third generation now gets to carry.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe built AI Intelligence alongside Manhattan Beer Distributors, the largest beer distributor in New York State, and the work has earned us a place at Stanford GSB Demo Day and recognition from NVIDIA. We help leaders like you make this generational transformation visible — to your family, your team, and your suppliers. Our technology can equip Gulf to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Gulf can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- "your grandmother Freida bought Jax Distributing in 1973 with 15 employees and four trucks" — [The Business View (Mobile Chamber)](https://thebusinessview.com/gulf-distributing-companys-50-year-legacy-elliot-maisel-takes-a-look-back-and-ahead/)\n- "after 25 years teaching school" — [The Business View (Mobile Chamber)](https://thebusinessview.com/gulf-distributing-companys-50-year-legacy-elliot-maisel-takes-a-look-back-and-ahead/)\n- "your father Elliot moved back to Mobile in 1974" — [Bay Business News](https://baybusinessnews.com/articles/elliot-maisel-chairman-ceo-gulf-distributing/)\n- "named a Molson Coors Legend in 2023" — [University of South Alabama](https://www.southalabama.edu/departments/publicrelations/pressreleases/030926daa.html)\n- "1,300+ people across three states with 120+ suppliers" — [University of South Alabama](https://www.southalabama.edu/departments/publicrelations/pressreleases/030926daa.html)\n- "signed Ohanafy's AI platform to modernize the entire enterprise" — [Brewbound](https://www.brewbound.com/pr/2026/03/06/gulf-distributing-holdings-selects-ohanafy-to-lead-enterprise-technology-transformation)\n- "commitment to being future-focused for employees, suppliers, and retailers for decades to come" — [Brewbound](https://www.brewbound.com/pr/2026/03/06/gulf-distributing-holdings-selects-ohanafy-to-lead-enterprise-technology-transformation)	348	f	07_heir__evan_b_maisel.md	2026-05-08 21:44:12.371847+02	Your grandmother Freida bought Jax Distributing in 1973 with 15 employees and four trucks after 25 years teaching school; your father Elliot moved back to Mobile in 1974 to build it with her and was named a Molson Coors Legend in 2023 for the half-century that followed. As SVP, you're stepping into that chair just as Gulf — now 1,300+ people across three states with 120+ suppliers — has signed Ohanafy's AI platform to modernize the entire enterprise.\n\nThat's a third-generation handoff happening at exactly the moment the operating model is being rewritten — and where the next generation gets to define what "future-focused" actually looks like in the field. Your father framed the Ohanafy decision as a commitment to being future-focused for employees, suppliers, and retailers for decades to come; that's the standard the third generation now gets to carry.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe built AI Intelligence alongside Manhattan Beer Distributors, the largest beer distributor in New York State, and the work has earned us a place at Stanford GSB Demo Day and recognition from NVIDIA. We help leaders like you make this generational transformation visible — to your family, your team, and your suppliers. Our technology can equip Gulf to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Gulf can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	From Freida's four trucks to Evan's SVP seat	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
24	527c6236-4192-4b05-8715-3d11a0942b6d	heir	Louis E. Maisel	\N	COO chair at the Ohanafy inflection	Your grandmother Freida founded Gulf in 1973 with 15 employees and four trucks; your father Elliot built it into a 1,300-person, 120-supplier business across Alabama, Florida and Mississippi and just moved the company into the former Mobile Press-Register building at 401 N. Water St. in October 2025. Taking the COO chair as that physical move lands — and as Gulf's new Ohanafy AI operating platform comes online — puts the operating spine of a three-generation company directly in your hands.\n\nThat's the kind of inflection where the COO either inherits a tech stack or gets to shape what comes next on top of it — and merchandising execution sits squarely on that fault line. Freida broke ground as the first woman to purchase a beer distributorship outright, and your father's framing of the Ohanafy move as a commitment to being future-focused sets a clear bar for whoever runs operations next.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAI Intelligence was built at Stanford and is the AI merchandising partner to Manhattan Beer Distributors, the largest beer distributor in New York. We help leaders like you make this transformation visible on the shelf, store by store. Our technology can equip Gulf to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Gulf can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- "founded Gulf in 1973 with 15 employees and four trucks" — [Brewbound](https://www.brewbound.com/pr/2026/03/06/gulf-distributing-holdings-selects-ohanafy-to-lead-enterprise-technology-transformation)\n- "1,300-person, 120-supplier business across Alabama, Florida and Mississippi" — [University of South Alabama](https://www.southalabama.edu/departments/publicrelations/pressreleases/030926daa.html)\n- "moved the company into the former Mobile Press-Register building at 401 N. Water St." — [AL.com](https://www.al.com/news/2025/01/thc-infused-beverages-mobile-mayoral-race-qa-with-beer-distributor-elliot-maisel.html)\n- "Gulf's new Ohanafy AI operating platform comes online" — [Brewbound](https://www.brewbound.com/pr/2026/03/06/gulf-distributing-holdings-selects-ohanafy-to-lead-enterprise-technology-transformation)\n- "first woman to purchase a beer distributorship outright" — [Bay Business News](https://baybusinessnews.com/articles/elliot-maisel-chairman-ceo-gulf-distributing/)\n- "commitment to being future-focused" — [Brewbound](https://www.brewbound.com/pr/2026/03/06/gulf-distributing-holdings-selects-ohanafy-to-lead-enterprise-technology-transformation)	352	f	08_heir__louis_e_maisel.md	2026-05-08 21:44:12.373893+02	Your grandmother Freida founded Gulf in 1973 with 15 employees and four trucks; your father Elliot built it into a 1,300-person, 120-supplier business across Alabama, Florida and Mississippi and just moved the company into the former Mobile Press-Register building at 401 N. Water St. in October 2025. Taking the COO chair as that physical move lands — and as Gulf's new Ohanafy AI operating platform comes online — puts the operating spine of a three-generation company directly in your hands.\n\nThat's the kind of inflection where the COO either inherits a tech stack or gets to shape what comes next on top of it — and merchandising execution sits squarely on that fault line. Freida broke ground as the first woman to purchase a beer distributorship outright, and your father's framing of the Ohanafy move as a commitment to being future-focused sets a clear bar for whoever runs operations next.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAI Intelligence was built at Stanford and is the AI merchandising partner to Manhattan Beer Distributors, the largest beer distributor in New York. We help leaders like you make this transformation visible on the shelf, store by store. Our technology can equip Gulf to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Gulf can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	COO chair at the Ohanafy inflection	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
28	be559c7b-c719-4812-a69c-a5ccbfb0ece0	vp_ops	Kevin O'Rourke		Five acquisitions, one ops backbone — where AI adds the most leverage	Kevin — as Vice President of Operations at Saratoga Eagle, you are the reason more than five million cases a year reach shelves across 13 counties without a beat missed. Five acquisitions in just over a decade — Ruch, Minogue's, Oneonta, Elmira and Plattsburgh — each had to be folded into one operations backbone, one warehouse, one fleet and one route map at a time.\n\nThat kind of operational complexity is exactly where AI creates the most leverage — in demand forecasting, route optimization, and putting the right product in the right store at the right time.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for operators like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe built AI Intelligence with Manhattan Beer, the largest independent beer distributor in the U.S., and our technology now reaches more than 20,000 stores. The work has been recognized by Stanford and supported by Google for Startups and NVIDIA. Our technology can equip Saratoga Eagle to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Saratoga Eagle can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- "now distributes more than five million cases annually across northeastern New York" — [Hobart and William Smith Colleges](https://www.hws.edu/alum/pssSpring21/vukelic.aspx)\n- "growth through acquisitions including Ruch (2010), Minogue's Beverage (2019), and distributorships in Oneonta and Elmira (2022)" — [Saratoga Business Journal](https://www.saratoga.com/saratogabusinessjournal/2021/11/minogues-beverage-center-business-now-owned-and-operated-by-saratoga-eagle/)	324	f	\N	2026-06-05 03:09:52.114939+02	\N	\N	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
1	be559c7b-c719-4812-a69c-a5ccbfb0ece0	ceo	Jeffrey "Jeff" Vukelic	\N	What Would Dad Do?	Hi Jeff,\n\nYour grandfather and father built the company through Prohibition, the Great Depression, World War II, and decades of industry change. That kind of legacy is about more than endurance — it is about leadership, resilience, and each generation taking the business to a higher level. You faced your own defining test during COVID and led through it successfully as well.\n\nI believe we are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and I believe this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. I'm reaching out because AI Intelligence works with industry leaders and is the number one AI company in the U.S. focused on beer and beverage execution. We work with distributors such as Manhattan Beer, and our technology is already used in more than 20,000 stores across New York.\n\nAI Intelligence emerged from a high-performance innovation ecosystem and earned recognition through leading accelerator communities, including Google for Startups, Techstars by JPMorgan Chase, Nvidia, Stanford Emergence Accelerator, Stanford Graduate School of Business Demo Day, and other global programs. AI Intelligence was born at Stanford — ground zero for the talent, ideas, and leadership that built the modern AI and technology economy, including the ecosystem behind ChatGPT, Google, Apple, and NVIDIA. From the beginning, it was built as a specialized AI company focused on the real needs of the CPG industry.\n\nI'm confident our innovation and technology can equip your business to reach new heights in this unique moment.\n\nMy team and I will be in Washington next week for meetings on Capitol Hill about how AI policy is shaping our industry. Given your background — and your years working with Congressman Bill Paxon — the Hill is probably familiar ground for you, so I wanted to ask whether you'll be in town as well.\n\nIf you're in Washington that week, it would be great to grab a coffee. If not, I'm happy to jump on a 15-min call anytime next week. Please advise the best time for a call with you next week?\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- "your grandfather Stephen — 'The Chief' — was 27 years old when he started bottling soft drinks in Lackawanna" — [Greater Olean Area Chamber of Commerce](https://www.facebook.com/OleanNYChamber/posts/welcome-to-the-chamber-new-member-try-it-distributing-try-it-distributing-is-an-/938607411642066/)\n- "adding Budweiser and Michelob in 1946 and Labatt in 1949" — [Greater Olean Area Chamber of Commerce](https://www.facebook.com/OleanNYChamber/posts/welcome-to-the-chamber-new-member-try-it-distributing-try-it-distributing-is-an-/938607411642066/)\n- "your father Gene took that foundation and guided the company through the Great Depression, World War II, and the beverage industry's evolution" — [Hobart and William Smith Colleges](https://www.hws.edu/alum/pssSpring21/vukelic.aspx)\n- "steering the fourth-generation family company" — [Hobart and William Smith Colleges](https://www.hws.edu/alum/pssSpring21/vukelic.aspx)\n- "2019 Plattsburgh acquisition that grew your footprint to 13 counties in Eastern New York" — [Saratogian](https://www.saratogian.com/2019/02/17/saratoga-eagle-sales-acquires-plattsburgh-distributing/)\n- "bringing Minogue's into the family after its 100th anniversary" — [Saratoga Business Journal](https://www.saratoga.com/saratogabusinessjournal/2021/11/minogues-beverage-center-business-now-owned-and-operated-by-saratoga-eagle/)	\N	f	01_ceo__jeffrey_jeff_vukelic.md	2026-05-08 19:21:14.727312+02	In 1928, your grandfather Stephen — "The Chief" — was 27 years old when he started bottling soft drinks in Lackawanna to slake thirsty Western New Yorkers during Prohibition, a single decision that would define the next 97 years. He charted the course by adding Budweiser and Michelob in 1946 and Labatt in 1949, and your father Gene took that foundation and guided the company through the Great Depression, World War II, and the beverage industry's evolution across the 20th century.\n\nNow you're steering the fourth-generation family company — Saratoga Eagle, Try-It, Sanzo, Minogue's, Plattsburgh — and the defining test of your generation is arriving on your desk. A legacy you now carry forward. From the 2019 Plattsburgh acquisition that grew your footprint to 13 counties in Eastern New York, to bringing Minogue's into the family after its 100th anniversary, you've shown a clear instinct for the next chapter.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe built AI Intelligence with Manhattan Beer, the largest independent beer distributor in the U.S., and our technology now reaches more than 20,000 stores. The work has been recognized by Stanford and supported by Google for Startups and NVIDIA. Our technology can equip Saratoga Eagle to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Saratoga Eagle can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	From The Chief's first bottling line to your fourth generation	t	2026-06-05 05:18:13.946177+02	admin	draft	\N	\N	\N	\N	\N	\N	\N	\N
6	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	ceo	Jeff Doll	\N	Carrying a family business into the next chapter	Building a multi-generational beverage distributorship in Iowa is no small feat — and stewarding it into a moment when AI is reshaping how distributors plan, route, and sell is a different kind of test than the one the prior generation faced. As a second-generation owner, you're sitting at exactly that inflection point.\n\nThat's the kind of moment where the right tools — not more headcount — decide whether the next decade compounds the family's work or just maintains it.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe built AI Intelligence alongside Manhattan Beer, the largest Anheuser-Busch distributor in the country, where our technology now supports execution across more than 20,000 stores. The work has been shaped at Stanford and backed by the Google for Startups and NVIDIA ecosystems — giving us a rare vantage point on what actually moves the needle for family-run distributors. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_	314	t	01_ceo__jeff_doll.md	2026-05-08 20:16:51.575235+02	Building a multi-generational beverage distributorship in Iowa is no small feat — and stewarding it into a moment when AI is reshaping how distributors plan, route, and sell is a different kind of test than the one the prior generation faced. As a second-generation owner, you're sitting at exactly that inflection point.\n\nThat's the kind of moment where the right tools — not more headcount — decide whether the next decade compounds the family's work or just maintains it.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe built AI Intelligence alongside Manhattan Beer, the largest Anheuser-Busch distributor in the country, where our technology now supports execution across more than 20,000 stores. The work has been shaped at Stanford and backed by the Google for Startups and NVIDIA ecosystems — giving us a rare vantage point on what actually moves the needle for family-run distributors. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	Carrying a family business into the next chapter	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
9	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	ceo	Scott Doll	\N	Second-gen ownership at an inflection point	Second-generation ownership of a beverage distributorship comes with a particular weight: you didn't start it, but the decisions made on your watch are the ones that determine whether the third generation inherits something stronger or just something older. The AI shift hitting our industry is shaping up to be one of those decisions.\n\nI work with distributor owners specifically on that question, and I'd value 15 minutes to share what's actually moving the needle.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe built our technology alongside Manhattan Beer, the largest Anheuser-Busch distributor in the country, and it now reaches more than 20,000 stores. The work has been shaped at Stanford and supported by Google for Startups, with the kind of rigor that family operators can actually trust on the floor and in the back office. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_	312	t	04_ceo__scott_doll.md	2026-05-08 20:16:51.579102+02	Second-generation ownership of a beverage distributorship comes with a particular weight: you didn't start it, but the decisions made on your watch are the ones that determine whether the third generation inherits something stronger or just something older. The AI shift hitting our industry is shaping up to be one of those decisions.\n\nI work with distributor owners specifically on that question, and I'd value 15 minutes to share what's actually moving the needle.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe built our technology alongside Manhattan Beer, the largest Anheuser-Busch distributor in the country, and it now reaches more than 20,000 stores. The work has been shaped at Stanford and supported by Google for Startups, with the kind of rigor that family operators can actually trust on the floor and in the back office. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	Second-gen ownership at an inflection point	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
2	be559c7b-c719-4812-a69c-a5ccbfb0ece0	cfo	Ken Davis	\N	13 counties, 5 acquisitions, one ops backbone	Since 2019 alone, Saratoga Eagle has absorbed Plattsburgh Distributing (extending the footprint to 13 counties in Eastern New York), Minogue's Beverage Center after its 100th anniversary in 2021, and Northern Eagle Beverages out of Oneonta plus Seneca Beverage Corp. in 2022 — on top of a $4 million, 35,000-square-foot addition in Saratoga Springs and the family's 2023 acquisition of Sanzo Beverage in Olean.\n\nThat's the kind of operational complexity — five acquisitions, a major facility expansion, and integration across two regions of New York — that puts a unique weight on the VP of Operations seat. Which is exactly why I wanted to reach you directly. Going from 190 employees and 5 million cases in 2012 to a fourth-generation operation spanning Western and Eastern New York is a different beast to run on the ops side every single day.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe build the operational backbone behind Manhattan Beer Distributors, where our AI cut audit time by roughly 70% and surfaced shrinkage and execution gaps across thousands of accounts that manual processes were missing. The technology came out of Stanford and is backed by NVIDIA's Inception program — and across our deployments it now touches 20,000+ stores. Our technology can equip Saratoga Eagle to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Saratoga Eagle can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- "acquired Plattsburgh Distributing" — [Saratogian](https://www.saratogian.com/2019/02/17/saratoga-eagle-sales-acquires-plattsburgh-distributing/)\n- "footprint to 13 counties in Eastern New York" — [Saratogian](https://www.saratogian.com/2019/02/17/saratoga-eagle-sales-acquires-plattsburgh-distributing/)\n- "Minogue's Beverage Center after its 100th anniversary in 2021" — [Saratoga Business Journal](https://www.saratoga.com/saratogabusinessjournal/2021/11/minogues-beverage-center-business-now-owned-and-operated-by-saratoga-eagle/)\n- "Northern Eagle Beverages out of Oneonta plus Seneca Beverage Corp. in 2022" — [Saratoga Business Journal](https://www.saratoga.com/saratogabusinessjournal/2022/01/saratoga-eagle-expands-by-acquiring-distributorships-in-oneonta-and-elmira/)\n- "$4 million, 35,000-square-foot addition in Saratoga Springs" — [Albany Business Review](https://www.bizjournals.com/albany/news/2018/11/13/saratoga-eagle-on-verge-of-expansion.html)\n- "2023 acquisition of Sanzo Beverage in Olean" — [Greater Olean Area Chamber of Commerce](https://www.facebook.com/OleanNYChamber/posts/welcome-to-the-chamber-new-member-try-it-distributing-try-it-distributing-is-an-/938607411642066/)\n- "190 employees and 5 million cases in 2012" — [Albany Business Review](https://www.bizjournals.com/albany/print-edition/2012/01/13/10-minutes-with-jeff-vukelic.html)\n- "fourth-generation operation spanning Western and Eastern New York" — [Hobart and William Smith Colleges - Pulteney Street Survey](https://www.hws.edu/alum/pssSpring21/vukelic.aspx)	365	f	02_cfo__ken_davis.md	2026-05-08 19:21:14.731705+02	Since 2019 alone, Saratoga Eagle has absorbed Plattsburgh Distributing (extending the footprint to 13 counties in Eastern New York), Minogue's Beverage Center after its 100th anniversary in 2021, and Northern Eagle Beverages out of Oneonta plus Seneca Beverage Corp. in 2022 — on top of a $4 million, 35,000-square-foot addition in Saratoga Springs and the family's 2023 acquisition of Sanzo Beverage in Olean.\n\nThat's the kind of operational complexity — five acquisitions, a major facility expansion, and integration across two regions of New York — that puts a unique weight on the VP of Operations seat. Which is exactly why I wanted to reach you directly. Going from 190 employees and 5 million cases in 2012 to a fourth-generation operation spanning Western and Eastern New York is a different beast to run on the ops side every single day.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe build the operational backbone behind Manhattan Beer Distributors, where our AI cut audit time by roughly 70% and surfaced shrinkage and execution gaps across thousands of accounts that manual processes were missing. The technology came out of Stanford and is backed by NVIDIA's Inception program — and across our deployments it now touches 20,000+ stores. Our technology can equip Saratoga Eagle to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Saratoga Eagle can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	13 counties, 5 acquisitions, one ops backbone	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
14	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	heir	Gus Doll	\N	Third generation at Doll	Stepping into a third-generation ownership role in a beverage distributorship is a strange mix of inheritance and reinvention — most of what made the company strong was built before you got there, but most of what will define your tenure hasn't been built yet. The AI shift hitting our industry is squarely in that second category.\n\nThat's the conversation I'd like to open with you, in 15 minutes, no pitch deck.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAt AI Intelligence, we work with Manhattan Beer — one of the largest family-owned distributors in the country — and the technology we built there came out of my time at Stanford. We help leaders like you make this transformation visible inside the company, so the next generation isn't just inheriting trucks and territories but a clear plan for what comes next. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- No external claims cited; safe_mode=true and no validated facts were provided.	311	t	09_heir__gus_doll.md	2026-05-08 20:16:51.58332+02	Stepping into a third-generation ownership role in a beverage distributorship is a strange mix of inheritance and reinvention — most of what made the company strong was built before you got there, but most of what will define your tenure hasn't been built yet. The AI shift hitting our industry is squarely in that second category.\n\nThat's the conversation I'd like to open with you, in 15 minutes, no pitch deck.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAt AI Intelligence, we work with Manhattan Beer — one of the largest family-owned distributors in the country — and the technology we built there came out of my time at Stanford. We help leaders like you make this transformation visible inside the company, so the next generation isn't just inheriting trucks and territories but a clear plan for what comes next. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	Third generation at Doll	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
15	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	heir	Charles Doll	\N	A note for the next generation at Doll	As a third-generation member of a family distributorship, you're seeing the business at a moment most prior generations never had to navigate — one where the tools, not just the relationships, are starting to determine which distributors lead their markets. That's a different inheritance than the one your parents and grandparents took on.\n\nI'd value your perspective on it as much as I'd want to share mine. Few people inherit a business at a moment like this one, and fewer still get to shape what the next chapter looks like.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nThat background is what brought our work to Manhattan Beer, the largest beer distributor in New York, and into the Stanford ecosystem where we continue to refine it. We help leaders like you make this transformation visible — turning AI from an abstract idea into something your team, your drivers, and your retail partners can actually see working in the field. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- No external claims cited; email uses only generic framing under safe_mode.	323	t	10_heir__charles_doll.md	2026-05-08 20:16:51.583603+02	As a third-generation member of a family distributorship, you're seeing the business at a moment most prior generations never had to navigate — one where the tools, not just the relationships, are starting to determine which distributors lead their markets. That's a different inheritance than the one your parents and grandparents took on.\n\nI'd value your perspective on it as much as I'd want to share mine. Few people inherit a business at a moment like this one, and fewer still get to shape what the next chapter looks like.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nThat background is what brought our work to Manhattan Beer, the largest beer distributor in New York, and into the Stanford ecosystem where we continue to refine it. We help leaders like you make this transformation visible — turning AI from an abstract idea into something your team, your drivers, and your retail partners can actually see working in the field. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	A note for the next generation at Doll	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
10	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	ceo	Jay Doll	\N	The second-gen owner's call	Every generation of a family distributorship gets one defining test — for the founders it was building the routes and the brand relationships; for the second generation, it's increasingly looking like the AI and data shift reshaping how distributors plan and sell. As a co-owner sitting in that seat, that test is yours.\n\nI'd like to share what a handful of comparable family distributors are doing about it, in plain English. The pattern is clear: the second generation that engages early with these tools tends to set the tone for the next twenty years of the business.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAt AI Intelligence, we work with Manhattan Beer Distributors, one of the largest family-owned beer distributors in the country, and our technology reaches into 20,000+ retail stores. The company was built out of Stanford, and is backed by Google for Startups, Techstars by JPMorgan Chase, and NVIDIA. We help second-generation leaders make this transformation visible inside their own four walls. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_	312	t	05_ceo__jay_doll.md	2026-05-08 20:16:51.581571+02	Every generation of a family distributorship gets one defining test — for the founders it was building the routes and the brand relationships; for the second generation, it's increasingly looking like the AI and data shift reshaping how distributors plan and sell. As a co-owner sitting in that seat, that test is yours.\n\nI'd like to share what a handful of comparable family distributors are doing about it, in plain English. The pattern is clear: the second generation that engages early with these tools tends to set the tone for the next twenty years of the business.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAt AI Intelligence, we work with Manhattan Beer Distributors, one of the largest family-owned beer distributors in the country, and our technology reaches into 20,000+ retail stores. The company was built out of Stanford, and is backed by Google for Startups, Techstars by JPMorgan Chase, and NVIDIA. We help second-generation leaders make this transformation visible inside their own four walls. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	The second-gen owner's call	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
11	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	heir	Lauren Doll-Sheeder	\N	Working alongside your father Mark	Working alongside your father Mark inside the family business — and on the sales and marketing side, no less — means you're seeing the brand from both the legacy seat and the modern-buyer seat at the same time. That's a rare vantage point in this industry.\n\nIt's also exactly where AI is starting to change what a distributor's sales and marketing function can actually do, which is why I wanted to reach out to you directly.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAI Intelligence was built alongside Manhattan Beer Distributors, one of the largest family-run beer distributors in the country, and the work we did there is now part of a Stanford Graduate School of Business case study on how next-generation leaders bring AI into a legacy operation. We help heirs like you make that transformation visible — to your team, to your suppliers, and to the family — without disrupting what already works. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- No external claims cited; email uses only the provided hook and AI Intelligence's own credentials.	312	t	06_heir__lauren_doll_sheeder.md	2026-05-08 20:16:51.581892+02	Working alongside your father Mark inside the family business — and on the sales and marketing side, no less — means you're seeing the brand from both the legacy seat and the modern-buyer seat at the same time. That's a rare vantage point in this industry.\n\nIt's also exactly where AI is starting to change what a distributor's sales and marketing function can actually do, which is why I wanted to reach out to you directly.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAI Intelligence was built alongside Manhattan Beer Distributors, one of the largest family-run beer distributors in the country, and the work we did there is now part of a Stanford Graduate School of Business case study on how next-generation leaders bring AI into a legacy operation. We help heirs like you make that transformation visible — to your team, to your suppliers, and to the family — without disrupting what already works. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	Working alongside your father Mark	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
12	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	heir	Andrew Doll	\N	Carrying the family business into AI era	Being a third-generation owner of the family distributorship means inheriting something the first two generations built largely by hand — and being the generation that has to decide what it looks like in an AI-shaped industry. Those are very different problems with the same last name attached.\n\nI work specifically with next-gen distributor owners on that handoff, and I'd value a short conversation.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe built AI Intelligence with Manhattan Beer, the largest beer distributor in New York, and our work has been shaped inside Stanford and through Stanford GSB Demo Day — where we help next-generation leaders make their transformation visible to the team, the suppliers, and the family. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_	264	t	07_heir__andrew_doll.md	2026-05-08 20:16:51.582121+02	Being a third-generation owner of the family distributorship means inheriting something the first two generations built largely by hand — and being the generation that has to decide what it looks like in an AI-shaped industry. Those are very different problems with the same last name attached.\n\nI work specifically with next-gen distributor owners on that handoff, and I'd value a short conversation.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe built AI Intelligence with Manhattan Beer, the largest beer distributor in New York, and our work has been shaped inside Stanford and through Stanford GSB Demo Day — where we help next-generation leaders make their transformation visible to the team, the suppliers, and the family. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	Carrying the family business into AI era	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
16	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	\N	\N	\N	\N	# Outreach drafts for Doll Distributing, LLC\n\n- [ceo → Jeff Doll](emails/01_ceo__jeff_doll.md) · _Carrying a family business into the next chapter_ · 314w\n- [ceo → Mark Doll](emails/02_ceo__mark_doll.md) · _A CEO's seat at a generational inflection_ · 295w\n- [ceo → Tami Doll](emails/03_ceo__tami_doll.md) · _Holding the operational line at Doll_ · 287w\n- [ceo → Scott Doll](emails/04_ceo__scott_doll.md) · _Second-gen ownership at an inflection point_ · 312w\n- [ceo → Jay Doll](emails/05_ceo__jay_doll.md) · _The second-gen owner's call_ · 312w\n- [heir → Lauren Doll-Sheeder](emails/06_heir__lauren_doll_sheeder.md) · _Working alongside your father Mark_ · 312w\n- [heir → Andrew Doll](emails/07_heir__andrew_doll.md) · _Carrying the family business into AI era_ · 264w\n- [heir → George Doll](emails/08_heir__george_doll.md) · _Third-gen at Doll Distributing_ · 295w\n- [heir → Gus Doll](emails/09_heir__gus_doll.md) · _Third generation at Doll_ · 311w\n- [heir → Charles Doll](emails/10_heir__charles_doll.md) · _A note for the next generation at Doll_ · 323w	\N	0	f	INDEX.md	2026-05-08 20:16:51.583811+02	# Outreach drafts for Doll Distributing, LLC\n\n- [ceo → Jeff Doll](emails/01_ceo__jeff_doll.md) · _Carrying a family business into the next chapter_ · 314w\n- [ceo → Mark Doll](emails/02_ceo__mark_doll.md) · _A CEO's seat at a generational inflection_ · 295w\n- [ceo → Tami Doll](emails/03_ceo__tami_doll.md) · _Holding the operational line at Doll_ · 287w\n- [ceo → Scott Doll](emails/04_ceo__scott_doll.md) · _Second-gen ownership at an inflection point_ · 312w\n- [ceo → Jay Doll](emails/05_ceo__jay_doll.md) · _The second-gen owner's call_ · 312w\n- [heir → Lauren Doll-Sheeder](emails/06_heir__lauren_doll_sheeder.md) · _Working alongside your father Mark_ · 312w\n- [heir → Andrew Doll](emails/07_heir__andrew_doll.md) · _Carrying the family business into AI era_ · 264w\n- [heir → George Doll](emails/08_heir__george_doll.md) · _Third-gen at Doll Distributing_ · 295w\n- [heir → Gus Doll](emails/09_heir__gus_doll.md) · _Third generation at Doll_ · 311w\n- [heir → Charles Doll](emails/10_heir__charles_doll.md) · _A note for the next generation at Doll_ · 323w	\N	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
17	527c6236-4192-4b05-8715-3d11a0942b6d	ceo	Elliot B. Maisel	\N	Your mother's 1973 bet, now an AI inflection	In 1973, after 25 years teaching middle school English, your mother Freida bought the assets of Jax Distributing — 15 employees and four trucks — and became the first woman to purchase a beer distributorship outright. You moved back to Mobile in 1974 to work alongside her, and a half-century later Gulf employs more than 1,300 people across Alabama, Florida and Mississippi, represents 120+ suppliers, and just selected Ohanafy as its AI operating platform — a bet you framed as your commitment to being "future-focused."\n\nThat technology pivot is the defining test for your generation of Gulf's leadership — and it's exactly where AI Intelligence fits in. Being named a MolsonCoors Legend in 2023 confirmed what the industry already knew: the Floribama Beer King has earned the right to define what comes next.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe built AI Intelligence alongside Manhattan Beer Distributors, where our AI now reaches 20,000+ stores across the Northeast. The work has been recognized by Stanford, where we presented at the GSB Demo Day, and supported by Google for Startups, Techstars by JPMorgan Chase, and NVIDIA. Our technology can equip Gulf to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Gulf can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- "after 25 years teaching middle school English" — [The Business View (Mobile Chamber)](https://thebusinessview.com/gulf-distributing-companys-50-year-legacy-elliot-maisel-takes-a-look-back-and-ahead/)\n- "15 employees and four trucks" — [The Business View (Mobile Chamber)](https://thebusinessview.com/gulf-distributing-companys-50-year-legacy-elliot-maisel-takes-a-look-back-and-ahead/)\n- "first woman to purchase a beer distributorship outright" — [Bay Business News](https://baybusinessnews.com/articles/elliot-maisel-chairman-ceo-gulf-distributing/)\n- "You moved back to Mobile in 1974" — [Bay Business News](https://baybusinessnews.com/articles/elliot-maisel-chairman-ceo-gulf-distributing/)\n- "employs more than 1,300 people across Alabama, Florida and Mississippi, represents 120+ suppliers" — [University of South Alabama](https://www.southalabama.edu/departments/publicrelations/pressreleases/030926daa.html)\n- "selected Ohanafy as its AI operating platform" — [Brewbound](https://www.brewbound.com/pr/2026/03/06/gulf-distributing-holdings-selects-ohanafy-to-lead-enterprise-technology-transformation)\n- "future-focused" — [Brewbound](https://www.brewbound.com/pr/2026/03/06/gulf-distributing-holdings-selects-ohanafy-to-lead-enterprise-technology-transformation)\n- "MolsonCoors Legend in 2023" — [University of South Alabama](https://www.southalabama.edu/departments/publicrelations/pressreleases/030926daa.html)\n- "Floribama Beer King" — [Beer Business Daily](https://beernet.com/bbd/bbd-article/the-floribama-beer-king-quietly-strikes-a-deal/)	333	f	01_ceo__elliot_b_maisel.md	2026-05-08 21:44:12.359785+02	In 1973, after 25 years teaching middle school English, your mother Freida bought the assets of Jax Distributing — 15 employees and four trucks — and became the first woman to purchase a beer distributorship outright. You moved back to Mobile in 1974 to work alongside her, and a half-century later Gulf employs more than 1,300 people across Alabama, Florida and Mississippi, represents 120+ suppliers, and just selected Ohanafy as its AI operating platform — a bet you framed as your commitment to being "future-focused."\n\nThat technology pivot is the defining test for your generation of Gulf's leadership — and it's exactly where AI Intelligence fits in. Being named a MolsonCoors Legend in 2023 confirmed what the industry already knew: the Floribama Beer King has earned the right to define what comes next.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe built AI Intelligence alongside Manhattan Beer Distributors, where our AI now reaches 20,000+ stores across the Northeast. The work has been recognized by Stanford, where we presented at the GSB Demo Day, and supported by Google for Startups, Techstars by JPMorgan Chase, and NVIDIA. Our technology can equip Gulf to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Gulf can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	Your mother's 1973 bet, now an AI inflection	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
19	527c6236-4192-4b05-8715-3d11a0942b6d	vp_sales	Jeff Floyd	\N	North Alabama, south Alabama, and the great state of Mobile	Jeff,\n\nRunning the North Division for a Blue/Silver house that Elliot trademarked as covering "north Alabama, south Alabama and the great state of Mobile" — and that Molson Coors named a Legend partner in 2023 — means you're executing across a 100+ supplier book where Surfside, Garage Beer, and Red Bull are doing the heavy lifting on growth. With the Supreme Beverage merger pulling Birmingham into the house, the shelf-execution surface area in your division just got materially bigger.\n\nThat's exactly the kind of brand-share fight where merchandising visibility — POS, displays, cooler resets — separates the divisions that hit plan from the ones that don't. When Rebecca says Gulf is "never done chasing," the North Division is where that chase shows up on the shelf.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAt Manhattan Beer, our computer-vision system reads coolers and displays across 20,000+ stores in real time — flagging voids, mis-sets, and competitor encroachment the same day a rep walks the door, so sell-through on priority brands like Surfside and Garage Beer doesn't leak between resets. The work is backed by NVIDIA and was featured at Stanford GSB Demo Day. Our technology can equip Gulf Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Gulf Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- "north Alabama, south Alabama and the great state of Mobile" — [The Business View (Mobile Chamber)](https://thebusinessview.com/gulf-distributing-companys-50-year-legacy-elliot-maisel-takes-a-look-back-and-ahead/)\n- "Molson Coors named a Legend partner in 2023" — [University of South Alabama](https://www.southalabama.edu/departments/publicrelations/pressreleases/030926daa.html)\n- "100+ supplier book where Surfside, Garage Beer, and Red Bull are doing the heavy lifting" — [Beer Business Daily](https://beernet.com/bbd/bbd-article/were-never-done-chasing-rebecca-maisel-on-gulfs-playbook/)\n- "Supreme Beverage merger pulling Birmingham into the house" — [Beer Business Daily](https://beernet.com/bbd/bbd-article/the-floribama-beer-king-quietly-strikes-a-deal/)\n- "never done chasing" — [Beer Business Daily](https://beernet.com/bbd/bbd-article/were-never-done-chasing-rebecca-maisel-on-gulfs-playbook/)	362	f	03_vp_sales__jeff_floyd.md	2026-05-08 21:44:12.365648+02	Jeff,\n\nRunning the North Division for a Blue/Silver house that Elliot trademarked as covering "north Alabama, south Alabama and the great state of Mobile" — and that Molson Coors named a Legend partner in 2023 — means you're executing across a 100+ supplier book where Surfside, Garage Beer, and Red Bull are doing the heavy lifting on growth. With the Supreme Beverage merger pulling Birmingham into the house, the shelf-execution surface area in your division just got materially bigger.\n\nThat's exactly the kind of brand-share fight where merchandising visibility — POS, displays, cooler resets — separates the divisions that hit plan from the ones that don't. When Rebecca says Gulf is "never done chasing," the North Division is where that chase shows up on the shelf.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAt Manhattan Beer, our computer-vision system reads coolers and displays across 20,000+ stores in real time — flagging voids, mis-sets, and competitor encroachment the same day a rep walks the door, so sell-through on priority brands like Surfside and Garage Beer doesn't leak between resets. The work is backed by NVIDIA and was featured at Stanford GSB Demo Day. Our technology can equip Gulf Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Gulf Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	North Alabama, south Alabama, and the great state of Mobile	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
20	527c6236-4192-4b05-8715-3d11a0942b6d	vp_sales	Domenic Olson	\N	Southern Division: Constellation, Boston Beer, Surfside	The Southern Division you run reaches across the entire state of Alabama, two regional areas in Mississippi, and the Florida panhandle — the territory Beer Business Daily had in mind when it nicknamed Elliot "The Floribama Beer King." With 120+ beverage suppliers behind you and growth brands like Surfside, Garage Beer, and Red Bull rounding out a Molson Coors / Constellation / Boston Beer core, every chain reset and c-store cooler in that footprint is a brand-share decision.\n\nThat's the kind of multi-state shelf execution where merchandising consistency — not just sales coverage — is what defends the Floribama crown. On a book Rebecca described as "never done chasing," a missed facing on Surfside or a late Garage Beer reset in the panhandle is the difference between a win and a write-up from the supplier.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAt Manhattan Beer, our computer-vision system detected a 12% void rate in real time across thousands of cooler doors and recovered meaningful sell-through on growth SKUs the chain teams cared about most. The same engine — backed by NVIDIA and validated through published Stanford case work — is now deployed across 20,000+ stores. Our technology can equip Gulf Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Gulf Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- "the entire state of Alabama, two regional areas in Mississippi, and the Florida panhandle" — [Mobile Chamber](https://mobilechamber.com/2023/01/gulf-distributing-to-relocate-operations-to-downtown-mobile/)\n- "Beer Business Daily had in mind when it nicknamed Elliot 'The Floribama Beer King'" — [Beer Business Daily](https://beernet.com/bbd/bbd-article/the-floribama-beer-king-quietly-strikes-a-deal/)\n- "120+ beverage suppliers" — [University of South Alabama](https://www.southalabama.edu/departments/publicrelations/pressreleases/030926daa.html)\n- "growth brands like Surfside, Garage Beer, and Red Bull rounding out a Molson Coors / Constellation / Boston Beer core" — [Beer Business Daily](https://beernet.com/bbd/bbd-article/were-never-done-chasing-rebecca-maisel-on-gulfs-playbook/)\n- "Rebecca described as 'never done chasing'" — [Beer Business Daily](https://beernet.com/bbd/bbd-article/were-never-done-chasing-rebecca-maisel-on-gulfs-playbook/)	359	f	04_vp_sales__domenic_olson.md	2026-05-08 21:44:12.366601+02	The Southern Division you run reaches across the entire state of Alabama, two regional areas in Mississippi, and the Florida panhandle — the territory Beer Business Daily had in mind when it nicknamed Elliot "The Floribama Beer King." With 120+ beverage suppliers behind you and growth brands like Surfside, Garage Beer, and Red Bull rounding out a Molson Coors / Constellation / Boston Beer core, every chain reset and c-store cooler in that footprint is a brand-share decision.\n\nThat's the kind of multi-state shelf execution where merchandising consistency — not just sales coverage — is what defends the Floribama crown. On a book Rebecca described as "never done chasing," a missed facing on Surfside or a late Garage Beer reset in the panhandle is the difference between a win and a write-up from the supplier.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAt Manhattan Beer, our computer-vision system detected a 12% void rate in real time across thousands of cooler doors and recovered meaningful sell-through on growth SKUs the chain teams cared about most. The same engine — backed by NVIDIA and validated through published Stanford case work — is now deployed across 20,000+ stores. Our technology can equip Gulf Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Gulf Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	Southern Division: Constellation, Boston Beer, Surfside	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
22	527c6236-4192-4b05-8715-3d11a0942b6d	heir	Rebecca L. Maisel	\N	"We're Never Done Chasing" — and the AI chapter	Your grandmother Freida founded Gulf in 1973 as the first woman to purchase a beer distributorship outright; your father Elliot moved home to Mobile in 1974 to build it with her; and in 2024 you stood up as NBWA Board Chair telling the industry "there is room at the very top… for qualified emerging leaders." A year later you were on the BREW Leadership Forum's father-daughter panel beside Elliot under the banner "We're Never Done Chasing" — and now Gulf has signed Ohanafy as its AI operating platform.\n\nAs Chief Corporate Strategy Officer carrying that three-generation legacy into an AI inflection, the strategic question stops being whether to modernize and starts being how visibly the modernization shows up at the shelf. Freida was described as having "broken new ground and glass ceilings, all with a steel backbone wrapped in charm" — that same instinct now sits with you as Gulf moves into its expanded downtown headquarters and onto a modern platform.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAI Intelligence was built with Manhattan Beer, the largest beer distributor in New York, where our AI runs across 20,000+ retail accounts. The technology came out of Stanford research and is backed by Google for Startups. We help leaders like you make this transformation visible — to your suppliers, your retailers, and the next generation watching. Our technology can equip Gulf to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Gulf can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- "your grandmother Freida founded Gulf in 1973" — [NBWA Daily Brew](http://nbwa.org/daily-brew/obituary-freida-gutlow-maisel/)\n- "the first woman to purchase a beer distributorship outright" — [Bay Business News](https://baybusinessnews.com/articles/elliot-maisel-chairman-ceo-gulf-distributing/)\n- "your father Elliot moved home to Mobile in 1974" — [Bay Business News](https://baybusinessnews.com/articles/elliot-maisel-chairman-ceo-gulf-distributing/)\n- "in 2024 you stood up as NBWA Board Chair" — [Brewbound](https://www.brewbound.com/news/nbwa-board-chair-rebecca-maisel-lets-go-back-to-basics/)\n- "there is room at the very top… for qualified emerging leaders" — [Brewbound](https://www.brewbound.com/news/nbwa-board-chair-rebecca-maisel-lets-go-back-to-basics/)\n- "BREW Leadership Forum's father-daughter panel beside Elliot" — [NBWA](https://nbwa.org/press-release/brewed-for-this-moment-brew-leadership-forum-delivers-star-power-and-timely-lessons/)\n- "We're Never Done Chasing" — [Beer Business Daily](https://beernet.com/bbd/bbd-article/were-never-done-chasing-rebecca-maisel-on-gulfs-playbook/)\n- "Gulf has signed Ohanafy as its AI operating platform" — [Brewbound](https://www.brewbound.com/pr/2026/03/06/gulf-distributing-holdings-selects-ohanafy-to-lead-enterprise-technology-transformation)\n- "Chief Corporate Strategy Officer" — [NBWA](https://nbwa.org/press-release/brewed-for-this-moment-brew-leadership-forum-delivers-star-power-and-timely-lessons/)\n- "broken new ground and glass ceilings, all with a steel backbone wrapped in charm" — [NBWA Daily Brew](http://nbwa.org/daily-brew/obituary-freida-gutlow-maisel/)\n- "Gulf moves into its expanded downtown headquarters" — [Bay Business News](https://baybusinessnews.com/articles/elliot-maisel-chairman-ceo-gulf-distributing/)	358	f	06_heir__rebecca_l_maisel.md	2026-05-08 21:44:12.370702+02	Your grandmother Freida founded Gulf in 1973 as the first woman to purchase a beer distributorship outright; your father Elliot moved home to Mobile in 1974 to build it with her; and in 2024 you stood up as NBWA Board Chair telling the industry "there is room at the very top… for qualified emerging leaders." A year later you were on the BREW Leadership Forum's father-daughter panel beside Elliot under the banner "We're Never Done Chasing" — and now Gulf has signed Ohanafy as its AI operating platform.\n\nAs Chief Corporate Strategy Officer carrying that three-generation legacy into an AI inflection, the strategic question stops being whether to modernize and starts being how visibly the modernization shows up at the shelf. Freida was described as having "broken new ground and glass ceilings, all with a steel backbone wrapped in charm" — that same instinct now sits with you as Gulf moves into its expanded downtown headquarters and onto a modern platform.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAI Intelligence was built with Manhattan Beer, the largest beer distributor in New York, where our AI runs across 20,000+ retail accounts. The technology came out of Stanford research and is backed by Google for Startups. We help leaders like you make this transformation visible — to your suppliers, your retailers, and the next generation watching. Our technology can equip Gulf to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Gulf can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	"We're Never Done Chasing" — and the AI chapter	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
21	527c6236-4192-4b05-8715-3d11a0942b6d	vp_sales	Joey Irelan	\N	The Red Bull book inside a $750M house	Red Bull sits inside a Gulf supplier book of more than 100 partners — alongside Molson Coors, Constellation, and Boston Beer — that the Wall Street Journal pegged at roughly $750M in annual gross revenue across Alabama, Mississippi, and the Florida panhandle. Running the Red Bull VP seat in a house that just signed Ohanafy's AI operating platform means your single-supplier P&L is about to get a lot more visible to everyone above you.\n\nThat's the kind of brand-specific spotlight where merchandising execution at the cooler door is what turns a good Red Bull year into a category-defining one. With Rebecca Maisel telling the trade "we're never done chasing," the bar for what a supplier-specific sell-through story looks like inside Gulf has clearly moved.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAt Manhattan Beer, our computer vision detected a 12% void rate at the cooler door in real time and recovered meaningful sell-through across more than 20,000 stores — exactly the kind of brand-level visibility a Red Bull book demands. The work has been recognized by Stanford and NVIDIA, and our case studies are now being shared with distributors actively rebuilding their tech stacks. Our technology can equip Gulf to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Gulf can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- "roughly $750M in annual gross revenue" — [Beer Business Daily](https://beernet.com/bbd/bbd-article/were-never-done-chasing-rebecca-maisel-on-gulfs-playbook/)\n- "more than 100 partners — alongside Molson Coors, Constellation, and Boston Beer" — [Beer Business Daily](https://beernet.com/bbd/bbd-article/were-never-done-chasing-rebecca-maisel-on-gulfs-playbook/)\n- "just signed Ohanafy's AI operating platform" — [Brewbound](https://www.brewbound.com/pr/2026/03/06/gulf-distributing-holdings-selects-ohanafy-to-lead-enterprise-technology-transformation)\n- "Rebecca Maisel telling the trade 'we're never done chasing'" — [Beer Business Daily](https://beernet.com/bbd/bbd-article/were-never-done-chasing-rebecca-maisel-on-gulfs-playbook/)	363	f	05_vp_sales__joey_irelan.md	2026-05-08 21:44:12.369758+02	Red Bull sits inside a Gulf supplier book of more than 100 partners — alongside Molson Coors, Constellation, and Boston Beer — that the Wall Street Journal pegged at roughly $750M in annual gross revenue across Alabama, Mississippi, and the Florida panhandle. Running the Red Bull VP seat in a house that just signed Ohanafy's AI operating platform means your single-supplier P&L is about to get a lot more visible to everyone above you.\n\nThat's the kind of brand-specific spotlight where merchandising execution at the cooler door is what turns a good Red Bull year into a category-defining one. With Rebecca Maisel telling the trade "we're never done chasing," the bar for what a supplier-specific sell-through story looks like inside Gulf has clearly moved.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAt Manhattan Beer, our computer vision detected a 12% void rate at the cooler door in real time and recovered meaningful sell-through across more than 20,000 stores — exactly the kind of brand-level visibility a Red Bull book demands. The work has been recognized by Stanford and NVIDIA, and our case studies are now being shared with distributors actively rebuilding their tech stacks. Our technology can equip Gulf to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Gulf can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	The Red Bull book inside a $750M house	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
8	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	ceo	Tami Doll	\N	Holding the operational line at Doll	Holding a Vice President seat inside a multi-generational family distributorship means absorbing pressure from two directions at once — the family's standards and the day-to-day operational reality of moving beverage volume across Iowa. That's a uniquely demanding chair.\n\nMost of the AI conversations in our industry skip past the people actually carrying that load — I'd rather start there.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe built AI Intelligence alongside Manhattan Beer, the largest beer distributor in New York State, and our technology now reaches across more than 20,000 stores. The work has been recognized by Stanford, where we presented at the GSB Demo Day, and supported by Google for Startups and Techstars by JPMorgan Chase. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- No external claims cited; credibility statements refer to AI Intelligence's own track record.	287	t	03_ceo__tami_doll.md	2026-05-08 20:16:51.578926+02	Holding a Vice President seat inside a multi-generational family distributorship means absorbing pressure from two directions at once — the family's standards and the day-to-day operational reality of moving beverage volume across Iowa. That's a uniquely demanding chair.\n\nMost of the AI conversations in our industry skip past the people actually carrying that load — I'd rather start there.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe built AI Intelligence alongside Manhattan Beer, the largest beer distributor in New York State, and our technology now reaches across more than 20,000 stores. The work has been recognized by Stanford, where we presented at the GSB Demo Day, and supported by Google for Startups and Techstars by JPMorgan Chase. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	Holding the operational line at Doll	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
13	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	heir	George Doll	\N	Third-gen at Doll Distributing	Each generation of a family distributorship inherits a different problem — routes and relationships for the founders, scale and consolidation for the second generation, and now, for the third, an AI-driven reshaping of how distributors plan, sell, and execute. You're stepping in at exactly that turn.\n\nI'd like to share, briefly, what a handful of next-gen distributor owners are quietly doing about it.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe partner with Manhattan Beer, one of the largest independent distributors in the country, and our work has been shaped through Stanford and the Stanford GSB Demo Day stage. The reason I'm reaching out specifically to next-generation owners is simple: this transition lands on your desk, not the prior generation's, and we help leaders like you make that transformation visible — to your team, your suppliers, and your family. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- No external claims cited; email uses only generic AI Intelligence credibility statements permitted by the playbook.	295	t	08_heir__george_doll.md	2026-05-08 20:16:51.582299+02	Each generation of a family distributorship inherits a different problem — routes and relationships for the founders, scale and consolidation for the second generation, and now, for the third, an AI-driven reshaping of how distributors plan, sell, and execute. You're stepping in at exactly that turn.\n\nI'd like to share, briefly, what a handful of next-gen distributor owners are quietly doing about it.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe partner with Manhattan Beer, one of the largest independent distributors in the country, and our work has been shaped through Stanford and the Stanford GSB Demo Day stage. The reason I'm reaching out specifically to next-generation owners is simple: this transition lands on your desk, not the prior generation's, and we help leaders like you make that transformation visible — to your team, your suppliers, and your family. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	Third-gen at Doll Distributing	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
18	527c6236-4192-4b05-8715-3d11a0942b6d	cfo	James R. Cox	\N	$750M, 3 states, and the Ohanafy migration	Gulf is running roughly $750M in annual gross revenue across more than 1,300 employees in Alabama, Florida and Mississippi, with 120+ suppliers led by Molson Coors, Constellation, and Boston Beer — and in March you announced the Ohanafy AI operating platform rollout to modernize that entire enterprise technology infrastructure. Layering an AI platform on top of three states, 100+ supplier P&Ls, and a brand-new downtown Mobile headquarters is a finance-and-ops puzzle most CFOs only get once in a career.\n\nThat's the kind of operational complexity where the wrong merchandising data layer can quietly bleed margin — and where the right one compounds the Ohanafy investment. The move into the former Press-Register building at 401 N. Water St. only raises the stakes — every process you migrate now will set the cost structure for the next decade.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAt Manhattan Beer Distributors, our AI merchandising platform cut audit time by roughly 70% and surfaced void and shrinkage exposure across 20,000+ accounts that finance had never seen in real time. The work is built on research from Stanford and runs on NVIDIA infrastructure. Our technology can equip Gulf to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Gulf can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- "roughly $750M in annual gross revenue" — [Beer Business Daily](https://beernet.com/bbd/bbd-article/were-never-done-chasing-rebecca-maisel-on-gulfs-playbook/)\n- "more than 1,300 employees in Alabama, Florida and Mississippi" — [University of South Alabama](https://www.southalabama.edu/departments/publicrelations/pressreleases/030926daa.html)\n- "120+ suppliers led by Molson Coors, Constellation, and Boston Beer" — [Beer Business Daily](https://beernet.com/bbd/bbd-article/were-never-done-chasing-rebecca-maisel-on-gulfs-playbook/)\n- "Ohanafy AI operating platform rollout to modernize that entire enterprise technology infrastructure" — [Brewbound](https://www.brewbound.com/pr/2026/03/06/gulf-distributing-holdings-selects-ohanafy-to-lead-enterprise-technology-transformation)\n- "former Press-Register building at 401 N. Water St." — [AL.com](https://www.al.com/news/2025/01/thc-infused-beverages-mobile-mayoral-race-qa-with-beer-distributor-elliot-maisel.html)	373	f	02_cfo__james_r_cox.md	2026-05-08 21:44:12.364454+02	Gulf is running roughly $750M in annual gross revenue across more than 1,300 employees in Alabama, Florida and Mississippi, with 120+ suppliers led by Molson Coors, Constellation, and Boston Beer — and in March you announced the Ohanafy AI operating platform rollout to modernize that entire enterprise technology infrastructure. Layering an AI platform on top of three states, 100+ supplier P&Ls, and a brand-new downtown Mobile headquarters is a finance-and-ops puzzle most CFOs only get once in a career.\n\nThat's the kind of operational complexity where the wrong merchandising data layer can quietly bleed margin — and where the right one compounds the Ohanafy investment. The move into the former Press-Register building at 401 N. Water St. only raises the stakes — every process you migrate now will set the cost structure for the next decade.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAt Manhattan Beer Distributors, our AI merchandising platform cut audit time by roughly 70% and surfaced void and shrinkage exposure across 20,000+ accounts that finance had never seen in real time. The work is built on research from Stanford and runs on NVIDIA infrastructure. Our technology can equip Gulf to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Gulf can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	$750M, 3 states, and the Ohanafy migration	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
3	be559c7b-c719-4812-a69c-a5ccbfb0ece0	vp_sales	E.J. Harkins	\N	Saratoga Eagle's portfolio, on every shelf	Saratoga Eagle's portfolio carries some of the most storied names in beer — Anheuser-Busch and Labatt brands that Try-It first put into Western New York ballparks decades ago — and your team has spent the last few years pushing that footprint hard: Plattsburgh Distributing in 2019 added Clinton County and brought the territory to 13 counties across Eastern New York, on top of Minogue's century-old retail network.\n\nThat's a lot of brand equity to execute on — across grocery, c-store, on-premise, and now retail — and shelf execution is where good distributors win or lose the season. Moving 5 million cases a year through that kind of mixed channel mix only raises the stakes on every facing, every cold box, every endcap.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAt Manhattan Beer, our computer vision detected a 12% void rate in real-time across the cold box and recovered meaningful sell-through that was quietly walking out the door every week. The same technology — built with support from Stanford and NVIDIA — now sees more than 20,000 stores. Our technology can equip Saratoga Eagle to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Saratoga Eagle can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- "Anheuser-Busch and Labatt brands that Try-It first put into Western New York ballparks" — [Buffalo Rising](https://www.buffalorising.com/2025/08/heaven-gains-a-buffalo-icon-in-business-philanthropy-and-family-in-try-it-distributing-chairman-eugene-p-gene-vukelik/)\n- "Labatt in 1949" — [Greater Olean Area Chamber of Commerce](https://www.facebook.com/OleanNYChamber/posts/welcome-to-the-chamber-new-member-try-it-distributing-try-it-distributing-is-an-/938607411642066/)\n- "Plattsburgh Distributing in 2019 added Clinton County" — [Saratogian](https://www.saratogian.com/2019/02/17/saratoga-eagle-sales-acquires-plattsburgh-distributing/)\n- "13 counties across Eastern New York" — [Saratogian](https://www.saratogian.com/2019/02/17/saratoga-eagle-sales-acquires-plattsburgh-distributing/)\n- "Minogue's century-old retail network" — [Saratoga Business Journal](https://www.saratoga.com/saratogabusinessjournal/2021/11/minogues-beverage-center-business-now-owned-and-operated-by-saratoga-eagle/)\n- "5 million cases a year" — [Albany Business Review](https://www.bizjournals.com/albany/print-edition/2012/01/13/10-minutes-with-jeff-vukelic.html)	323	f	03_vp_sales__e_j_harkins.md	2026-05-08 19:21:14.732304+02	Saratoga Eagle's portfolio carries some of the most storied names in beer — Anheuser-Busch and Labatt brands that Try-It first put into Western New York ballparks decades ago — and your team has spent the last few years pushing that footprint hard: Plattsburgh Distributing in 2019 added Clinton County and brought the territory to 13 counties across Eastern New York, on top of Minogue's century-old retail network.\n\nThat's a lot of brand equity to execute on — across grocery, c-store, on-premise, and now retail — and shelf execution is where good distributors win or lose the season. Moving 5 million cases a year through that kind of mixed channel mix only raises the stakes on every facing, every cold box, every endcap.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nAt Manhattan Beer, our computer vision detected a 12% void rate in real-time across the cold box and recovered meaningful sell-through that was quietly walking out the door every week. The same technology — built with support from Stanford and NVIDIA — now sees more than 20,000 stores. Our technology can equip Saratoga Eagle to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Saratoga Eagle can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	Saratoga Eagle's portfolio, on every shelf	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
7	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	ceo	Mark Doll	\N	A CEO's seat at a generational inflection	Running a family beverage distributorship as CEO in 2025 is a fundamentally different job than it was for the generation that built it — the relationships still matter, but the operating tempo has changed. Sitting in that chair as a second-generation leader means owning both the legacy and the next reinvention.\n\nThe distributors pulling ahead right now are the ones using AI to compress decisions that used to take weeks — and that's the conversation I'd like to open with you.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe built AI Intelligence alongside Manhattan Beer, the largest Anheuser-Busch distributor in the country, and our technology now touches more than 20,000 stores. The work has been shaped at Stanford and supported by Techstars backed by JPMorgan Chase, giving us both the academic rigor and the operator instincts this industry demands. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- No external claims cited; safe mode email uses only generic credibility markers.	295	t	02_ceo__mark_doll.md	2026-05-08 20:16:51.578372+02	Running a family beverage distributorship as CEO in 2025 is a fundamentally different job than it was for the generation that built it — the relationships still matter, but the operating tempo has changed. Sitting in that chair as a second-generation leader means owning both the legacy and the next reinvention.\n\nThe distributors pulling ahead right now are the ones using AI to compress decisions that used to take weeks — and that's the conversation I'd like to open with you.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe built AI Intelligence alongside Manhattan Beer, the largest Anheuser-Busch distributor in the country, and our technology now touches more than 20,000 stores. The work has been shaped at Stanford and supported by Techstars backed by JPMorgan Chase, giving us both the academic rigor and the operator instincts this industry demands. Our technology can equip Doll Distributing to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Doll Distributing can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	A CEO's seat at a generational inflection	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
25	527c6236-4192-4b05-8715-3d11a0942b6d	\N	\N	\N	\N	# Outreach drafts for Gulf Distributing Holdings, LLC\n\n- [ceo → Elliot B. Maisel](emails/01_ceo__elliot_b_maisel.md) · _Your mother's 1973 bet, now an AI inflection_ · 333w\n- [cfo → James R. Cox](emails/02_cfo__james_r_cox.md) · _$750M, 3 states, and the Ohanafy migration_ · 373w\n- [vp_sales → Jeff Floyd](emails/03_vp_sales__jeff_floyd.md) · _North Alabama, south Alabama, and the great state of Mobile_ · 362w\n- [vp_sales → Domenic Olson](emails/04_vp_sales__domenic_olson.md) · _Southern Division: Constellation, Boston Beer, Surfside_ · 359w\n- [vp_sales → Joey Irelan](emails/05_vp_sales__joey_irelan.md) · _The Red Bull book inside a $750M house_ · 363w\n- [heir → Rebecca L. Maisel](emails/06_heir__rebecca_l_maisel.md) · _"We're Never Done Chasing" — and the AI chapter_ · 358w\n- [heir → Evan B. Maisel](emails/07_heir__evan_b_maisel.md) · _From Freida's four trucks to Evan's SVP seat_ · 348w\n- [heir → Louis E. Maisel](emails/08_heir__louis_e_maisel.md) · _COO chair at the Ohanafy inflection_ · 352w	\N	0	f	INDEX.md	2026-05-08 21:44:12.376199+02	# Outreach drafts for Gulf Distributing Holdings, LLC\n\n- [ceo → Elliot B. Maisel](emails/01_ceo__elliot_b_maisel.md) · _Your mother's 1973 bet, now an AI inflection_ · 333w\n- [cfo → James R. Cox](emails/02_cfo__james_r_cox.md) · _$750M, 3 states, and the Ohanafy migration_ · 373w\n- [vp_sales → Jeff Floyd](emails/03_vp_sales__jeff_floyd.md) · _North Alabama, south Alabama, and the great state of Mobile_ · 362w\n- [vp_sales → Domenic Olson](emails/04_vp_sales__domenic_olson.md) · _Southern Division: Constellation, Boston Beer, Surfside_ · 359w\n- [vp_sales → Joey Irelan](emails/05_vp_sales__joey_irelan.md) · _The Red Bull book inside a $750M house_ · 363w\n- [heir → Rebecca L. Maisel](emails/06_heir__rebecca_l_maisel.md) · _"We're Never Done Chasing" — and the AI chapter_ · 358w\n- [heir → Evan B. Maisel](emails/07_heir__evan_b_maisel.md) · _From Freida's four trucks to Evan's SVP seat_ · 348w\n- [heir → Louis E. Maisel](emails/08_heir__louis_e_maisel.md) · _COO chair at the Ohanafy inflection_ · 352w	\N	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
26	be559c7b-c719-4812-a69c-a5ccbfb0ece0	owner	Paul Vukelic		From The Chief's 1919 start to Try-It & Saratoga Eagle's AI advantage	Paul — the business your grandfather Stephen "The Chief" Vukelic started has become a genuine New York institution: Try-It Distributing and Balkan Beverage out of Lancaster, an Anheuser-Busch and Labatt footprint across Western New York, and — with your brother Jeff — Saratoga Eagle to the east and Minogue's Beverage Centers added in 2021. Few families have carried a distributorship into its third and fourth generation the way the Vukelics have.\n\nAs President/CEO of Try-It and now Executive Chairman of Try-It Beverage across Niagara and Erie counties, you've spent a career making the operation bigger and tighter at the same time. That is exactly the kind of business the next decade will reward — or leave behind.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for leaders like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe built AI Intelligence with Manhattan Beer, the largest independent beer distributor in the U.S., and our technology now reaches more than 20,000 stores. The work has been recognized by Stanford and supported by Google for Startups and NVIDIA. Our technology can equip the Vukelic family of companies to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Try-It and Saratoga Eagle can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- "President/CEO of Try-It Distributing Co., Inc. & Balkan Beverage LLC in Lancaster, NY" — [Try-It Distributing](https://www.tryitdistributing.com/)\n- "Co-owner with brother Jeff of Saratoga Eagle and Minogue's Beverage Centers" — [Saratoga Business Journal](https://www.saratoga.com/saratogabusinessjournal/2021/11/minogues-beverage-center-business-now-owned-and-operated-by-saratoga-eagle/)	338	f	\N	2026-06-05 03:09:52.114939+02	\N	\N	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
27	be559c7b-c719-4812-a69c-a5ccbfb0ece0	president	John Fisher		Holding service steady across 13 counties — the AI operations edge	John — as President of Saratoga Eagle Sales & Service, you run one of the most respected independent distributorships in Eastern New York day to day: more than five million cases a year moving across a 13-county footprint that grew through the 2019 Plattsburgh acquisition and the addition of Minogue's Beverage Centers after its 100th anniversary.\n\nHolding service levels steady while a business expands that fast is the hardest job in distribution — and it is precisely where the next wave of technology will separate the leaders from everyone else.\n\nWe are now entering another historic turning point: the AI revolution. Like the Industrial Revolution, it will fundamentally reshape the economy and the way business is done — and this is a rare opportunity for operators like you to take the business to its next level.\n\nMy name is Anna. Like you, I grew up in the beer and beverage distribution business. As a kid, I took orders, helped restock shelves, and fixed trucks with my dad. That is why I decided to build AI Intelligence — to help family businesses like the one I grew up in thrive in the age of AI.\n\nWe built AI Intelligence with Manhattan Beer, the largest independent beer distributor in the U.S., and our technology now reaches more than 20,000 stores. The work has been recognized by Stanford and supported by Google for Startups and NVIDIA. Our technology can equip Saratoga Eagle to reach new heights in this unique moment.\n\nMy team and I will be in Washington for the NBWA Legislative Conference starting this Sunday. It would be great to grab a coffee and discuss how Saratoga Eagle can lead the next wave of AI transformation in our industry.\n\nCheers,\nAnna	**Sources** _(for your verification — not part of the email message)_\n\n- "2019 Plattsburgh acquisition that grew your footprint to 13 counties in Eastern New York" — [Saratogian](https://www.saratogian.com/2019/02/17/saratoga-eagle-sales-acquires-plattsburgh-distributing/)\n- "bringing Minogue's into the family after its 100th anniversary" — [Saratoga Business Journal](https://www.saratoga.com/saratogabusinessjournal/2021/11/minogues-beverage-center-business-now-owned-and-operated-by-saratoga-eagle/)	312	f	\N	2026-06-05 03:09:52.114939+02	\N	\N	f	\N	\N	draft	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: email_event; Type: TABLE DATA; Schema: research; Owner: evgenyarol
--

COPY research.email_event (id, email_id, person_id, kind, payload, occurred_at) FROM stdin;
\.


--
-- Data for Name: email_thread; Type: TABLE DATA; Schema: research; Owner: evgenyarol
--

COPY research.email_thread (id, person_id, distributor_id, email_id, direction, subject, body_text, body_html, from_addr, to_addr, occurred_at, raw_payload) FROM stdin;
\.


--
-- Data for Name: fact; Type: TABLE DATA; Schema: research; Owner: evgenyarol
--

COPY research.fact (id, distributor_id, fact_type, subject, predicate, object, verbatim_quote, article_id, confidence, validated) FROM stdin;
319	527c6236-4192-4b05-8715-3d11a0942b6d	founding_moment	Freida G. Maisel	founded_company_in_year	1973	In 1973, Freida bought a small beverage wholesaler in Mobile, renamed it Gulf Distributing Company, and built the foundation of a business that now serves customers in six states and employs nearly 2,000 people.	142	1	t
320	527c6236-4192-4b05-8715-3d11a0942b6d	biographical	Freida G. Maisel	died_at_age	95	Freida G. Maisel, 95, died in her home in her native Mobile.	142	1	t
321	527c6236-4192-4b05-8715-3d11a0942b6d	biographical	Freida G. Maisel	retired_at_age	70	Freida retired at the age of 70 and handed Gulf over to her son Elliot but she remained interested in and apprised of the business until her final days.	142	1	t
322	527c6236-4192-4b05-8715-3d11a0942b6d	family_relation	Elliot B. Maisel	is_son_of	Freida G. Maisel	Freida retired at the age of 70 and handed Gulf over to her son Elliot but she remained interested in and apprised of the business until her final days.	142	1	t
323	527c6236-4192-4b05-8715-3d11a0942b6d	company_milestone	Freida G. Maisel	received_award	NBWA Life Service Award (2009)	In 2009, Frieda was honored with NBWA's Life Service Award. And just last year, NBWA announced the establishment of the Freida G. Maisel Trailblazer Award.	142	1	t
324	527c6236-4192-4b05-8715-3d11a0942b6d	press_quote	Freida G. Maisel	described_in_obituary_as	broke new ground and glass ceilings, all with a steel backbone wrapped in charm	She broke new ground and glass ceilings, all with a steel backbone wrapped in charm.	142	1	t
325	527c6236-4192-4b05-8715-3d11a0942b6d	biographical	Freida G. Maisel	attended_high_school	Murphy High School, Class of 1945	I knew Freida at Murphy High School. We were in the same class of 1945.	143	1	t
326	527c6236-4192-4b05-8715-3d11a0942b6d	biographical	Freida G. Maisel	lifespan	1928 - 2023	Freida Maisel Obituary (1928 - 2023) - Mobile, AL	143	1	t
327	527c6236-4192-4b05-8715-3d11a0942b6d	founding_moment	Gulf Distributing Company	founded_on_date	December 19, 1973	Gulf Distributing Company was established on December 19, 1973, by Freida G. Maisel, a Mobile native born into an immigrant family.	144	1	t
328	527c6236-4192-4b05-8715-3d11a0942b6d	biographical	Freida G. Maisel	former_career	school teacher for 25 years before buying Jax Distributing Company	After working as a school teacher for 25 years, she bought the assets of what had once been Jax Distributing Company.	144	1	t
329	527c6236-4192-4b05-8715-3d11a0942b6d	company_milestone	Gulf Distributing Company	acquired_assets_of	Jax Distributing Company (in business since 1935, with 15 employees and four trucks)	The company had been in business since 1935 and at the time had 15 employees and four trucks.	144	1	t
330	527c6236-4192-4b05-8715-3d11a0942b6d	family_relation	Elliot B. Maisel	is_son_of	Herman Maisel	His father, Herman Maisel, was the one who initially found the opportunity to buy Jax Distributing Company.	144	1	t
331	527c6236-4192-4b05-8715-3d11a0942b6d	press_quote	Elliot B. Maisel	said_in_interview	My father was a dynamo. We wouldn't have Gulf if it wasn't for him.	My father was a dynamo. We wouldn't have Gulf if it wasn't for him. He had vision and he had courage. In our family story, it is well-known that he wanted to buy it. In Alabama and in most states, you cannot be a wholesaler and a retailer. He was a retailer. So, my mother bought the company and for that we are very thankful,	144	1	t
332	527c6236-4192-4b05-8715-3d11a0942b6d	press_quote	Elliot B. Maisel	trademarked_expression	there's north Alabama, south Alabama and the great state of Mobile	I trademarked an expression many years ago: there's north Alabama, south Alabama and the great state of Mobile.	144	1	t
333	527c6236-4192-4b05-8715-3d11a0942b6d	company_milestone	Gulf Distributing	moved_headquarters	expanded headquarters in downtown Mobile, October 2025	In October 2025, Gulf moved into a new, expanded headquarters in downtown Mobile, building on the success of the last 50-plus years and providing a space that can support company growth.	145	1	t
334	527c6236-4192-4b05-8715-3d11a0942b6d	biographical	Elliot B. Maisel	career_pivot	moved back to Mobile in 1974 to work at Gulf Distributing and Herman Maisel and Company	After graduating, I moved back to Mobile in 1974 and worked at both Gulf Distributing and Herman Maisel and Company.	145	1	t
335	527c6236-4192-4b05-8715-3d11a0942b6d	biographical	Elliot B. Maisel	career_history	bought and operated Hamrick Motor Company auto dealerships in 1980s; pari-mutuel racing development; sold interests in 1990	In the 1980s, I bought and operated the Hamrick Motor Company auto dealerships and later worked on pari-mutuel racing development projects before selling those interests in 1990. After that, I focused my attention fully on Gulf Distributing.	145	1	t
336	527c6236-4192-4b05-8715-3d11a0942b6d	press_quote	Elliot B. Maisel	said_in_interview	his mother was the first woman to purchase a beer distributorship outright	My mother founded Gulf Distributing after a 30-year career teaching middle school English. At the time she started the company, she was recognized as the first woman to purchase a beer distributorship outright and one of a very few wholly woman-owned beer distributors in the U.S.	145	1	t
337	527c6236-4192-4b05-8715-3d11a0942b6d	company_milestone	Gulf Distributing	relocating_to	former Mobile Press-Register building at 401 N. Water St., downtown Mobile	The company will relocate next year into the former Mobile Press-Register building at 401 N. Water St.	146	1	t
338	527c6236-4192-4b05-8715-3d11a0942b6d	press_quote	Elliot B. Maisel	said_in_interview	It's about pride in the city	It's about pride in the city, and maybe it will encourage others to move their businesses downtown or locate their businesses in the city.	146	1	t
339	527c6236-4192-4b05-8715-3d11a0942b6d	biographical	Elliot B. Maisel	civic_role	chairman emeritus of the Mobile Airport Authority	Maisel, chairman emeritus of the Mobile Airport Authority, is busy overseeing the transition from Gulf Distributing's longtime headquarters on Moffett Road to downtown Mobile, while also seeking funding for the eventual opening of a five-gate commercial aviation terminal at the Mobile Aeroplex at Brookley.	146	1	t
170	be559c7b-c719-4812-a69c-a5ccbfb0ece0	founding_moment	Stephen L. Vukelic	founded_company_in_year	1928	Vukelic started bottling soft drinks in his native Lackawanna, New York in 1928, at age 27, to meet the demand of thirsty Western New Yorkers during prohibition.	68	1	t
171	be559c7b-c719-4812-a69c-a5ccbfb0ece0	biographical	Stephen L. Vukelic	was_known_as	The Chief	Stephen, fondly known as 'The Chief,' had charted the course for the company's successful future.	68	1	t
172	be559c7b-c719-4812-a69c-a5ccbfb0ece0	company_milestone	Try-It Distributing	added_brands_in_year	Budweiser and Michelob in 1946; Labatt in 1949	When Try-It added Budweiser and Michelob to its product list in 1946 and Labatt in 1949, Stephen, fondly known as "The Chief," had charted the course for the company's successful future.	68	1	t
173	be559c7b-c719-4812-a69c-a5ccbfb0ece0	company_milestone	Saratoga Eagle Sales & Service	acquired_by_family_in_year	2005	In 2005, the family acquired another Anheuser-Busch distributorship, Saratoga Eagle Sales & Service in Glens Falls, NY.	68	1	t
174	be559c7b-c719-4812-a69c-a5ccbfb0ece0	company_milestone	Try-It Wine & Spirits	was_formed_in	October 2013	In October 2013, Try-It Wine & Spirits was formed to distribute wine and liquor to Erie and Niagara Counties.	68	1	t
175	be559c7b-c719-4812-a69c-a5ccbfb0ece0	company_milestone	Sanzo Beverage	was_acquired_in	2023	In 2023, the family acquired another Anheuser-Busch distributorship, Sanzo Beverage in Olean, NY.	68	1	t
176	be559c7b-c719-4812-a69c-a5ccbfb0ece0	red_flag	Eugene P. "Gene" Vukelic	died_on	August 3, 2025	Eugene P. "Gene" Vukelic, Chairman of Try-It Distributing and Philanthropic Business Leader, Dies at 94. December 29, 1930 – August 3, 2025.	56	1	t
177	be559c7b-c719-4812-a69c-a5ccbfb0ece0	biographical	Eugene P. "Gene" Vukelic	was_born_on	December 29, 1930	December 29, 1930 – August 3, 2025.	56	1	t
178	be559c7b-c719-4812-a69c-a5ccbfb0ece0	company_milestone	Eugene P. "Gene" Vukelic	transformed_business	turned father's bootleg beer business into a multi-million-dollar company	Gene Vukelic, chairman of Try-It Distributing, died at 94. He turned his father's bootleg beer business into a multi-million-dollar company.	57	1	t
179	be559c7b-c719-4812-a69c-a5ccbfb0ece0	family_relation	Eugene P. "Gene" Vukelic	is_son_of	Stephen L. Vukelic	He turned his father's bootleg beer business into a multi-million-dollar company.	57	0.8	t
180	be559c7b-c719-4812-a69c-a5ccbfb0ece0	press_quote	Buffalo Rising (on Eugene Vukelic)	wrote_about	Gene Vukelic legacy of family	For Gene, the legacy of family was not only a testament to his life's work but the true measure of his success—a blessing he treasured above all.	58	1	t
181	be559c7b-c719-4812-a69c-a5ccbfb0ece0	company_milestone	Try-It Distributing	supplied_ballpark_with	Anheuser-Busch and Labatt brands of beer	He was Chairman of Try-It Distributing which supplied the ballpark with its Anheuser-Busch and Labatt brands of beer and from my first visit, he was the epitome of a gentleman, a legacy he carried throughout his storied career.	58	1	t
182	be559c7b-c719-4812-a69c-a5ccbfb0ece0	biographical	Eugene P. "Gene" Vukelic	mentored_and_supported	Buffalo's 'Baby Joe' Mesi	He carried that passion throughout his life and when Buffalo's "Baby Joe" Mesi emerged on the scene as a heavyweight professional contender, Gene was right there to support him financially and as a mentor.	58	1	t
183	be559c7b-c719-4812-a69c-a5ccbfb0ece0	biographical	Eugene P. "Gene" Vukelic	joined_business_in_year	1960	How did Try-It manage to become one of three major beer distributors in Buffalo when, back in 1960 when Gene Vukelic joined his father in [the business]...	59	1	t
184	be559c7b-c719-4812-a69c-a5ccbfb0ece0	company_milestone	Balkan Beverage	was_formed_by_in_year	Paul Vukelic in 2004	In 2004 son Paul Vukelic, president and COO, formed a subsidiary, Balkan Beverage, to distribute soft drinks like Red Bull, Arizona Tea, and others.	59	1	t
185	be559c7b-c719-4812-a69c-a5ccbfb0ece0	family_relation	Paul Vukelic	is_son_of	Eugene P. "Gene" Vukelic	In 2004 son Paul Vukelic, president and COO, formed a subsidiary, Balkan Beverage, to distribute soft drinks like Red Bull, Arizona Tea, and others.	59	0.8	t
186	be559c7b-c719-4812-a69c-a5ccbfb0ece0	biographical	Stephen G. Vukelic	had_lifespan	Oct. 27, 1927 – March 25, 2010	Stephen G. Vukelic, partner in Try-It Distributing Co.; Oct. 27, 1927 -- March 25, 2010	60	1	t
187	be559c7b-c719-4812-a69c-a5ccbfb0ece0	biographical	Stephen G. Vukelic	was_educated_at	Manlius Military Academy	Mr. Vukelic was a graduate of Manlius Military Academy and was a member of the football team at each school.	60	1	t
188	be559c7b-c719-4812-a69c-a5ccbfb0ece0	biographical	Stephen G. Vukelic	served_in	Marine Corps	He also was a Marine Corps veteran.	60	1	t
189	be559c7b-c719-4812-a69c-a5ccbfb0ece0	biographical	Stephen G. Vukelic	was_partner_at	Try-It Distributing Co.	Vukelic, a partner in Try-It Distributing Co. and a longtime resident of Hamburg, died March 25 in his Sebring, Fla., home.	60	1	t
190	be559c7b-c719-4812-a69c-a5ccbfb0ece0	company_milestone	Saratoga Eagle Sales & Service	acquired	Northern Eagle Beverages Inc. (Oneonta) and Seneca Beverage Corp. (Elmira)	Saratoga Eagle Sales & Service is in the process of acquiring two companies that will expand its reach distributing beer, wine, soft drinks and water to an additional eight counties upstate, according to president and chief operating officer Jeff Vukelic.	61	1	t
191	be559c7b-c719-4812-a69c-a5ccbfb0ece0	company_milestone	Try-It Distributing	originated_as	beverage bottling business by the late Stephen Vukelic in Buffalo in 1928	With roots stretching back to Buffalo in 1928 with parent company Try-It Distributing, what started as a beverage bottling business by the late Stephen Vukelic is now a multi-generational family company.	61	1	t
192	be559c7b-c719-4812-a69c-a5ccbfb0ece0	company_milestone	Try-It Distributing	expanded_into	Saratoga and Glens Falls areas with grandson Jeff Vukelic as COO	This is the time frame when Try-It expanded into the Saratoga and Glens Falls areas with a new distribution hub subsidiary out of Saratoga Springs and grandson Jeff Vukelic took on the role of COO.	61	1	t
193	be559c7b-c719-4812-a69c-a5ccbfb0ece0	family_relation	Jeff Vukelic	is_grandson_of	Stephen L. Vukelic	This is the time frame when Try-It expanded into the Saratoga and Glens Falls areas with a new distribution hub subsidiary out of Saratoga Springs and grandson Jeff Vukelic took on the role of COO.	61	1	t
194	be559c7b-c719-4812-a69c-a5ccbfb0ece0	press_quote	Jeff Vukelic	said_in_interview	company has reduced costs and operates more efficiently	As a company, we've had success in reducing costs and operating more efficiently over the past couple years.	62	1	t
195	be559c7b-c719-4812-a69c-a5ccbfb0ece0	company_milestone	Jeff Vukelic	became_president_and_CEO_in_year	2005	In 2005, Jeff Vukelic took over as president and chief executive officer.	62	1	t
196	be559c7b-c719-4812-a69c-a5ccbfb0ece0	company_milestone	Saratoga Eagle Sales & Service	acquired	Ruch Distributors Inc. of Albany	SARATOGA SPRINGS – Saratoga Eagle Sales & Service has formally completed its purchase of Ruch Distributors Inc. of Albany.	63	1	t
197	be559c7b-c719-4812-a69c-a5ccbfb0ece0	business_metric	Saratoga Eagle Sales & Service	doubled_market_via_Ruch_acquisition	all of Albany and Rensselaer counties	The acquisition virtually doubles Saratoga Eagle's market to include all of Albany and Rensselaer counties.	63	1	t
198	be559c7b-c719-4812-a69c-a5ccbfb0ece0	business_metric	Saratoga Eagle Sales & Service	hired_employees_from_Ruch	34 of 51 Ruch employees	Thirty-four of Ruch's 51 employees will be hired by Saratoga Eagle in all areas, from sales and marketing to delivery personnel.	63	1	t
199	be559c7b-c719-4812-a69c-a5ccbfb0ece0	press_quote	Jeff Vukelic	said_in_interview	Ruch acquisition won't dramatically impact employees or customers	Our two organizations have a great deal in common, and this acquisition will not have a dramatic impact on the Ruch employees or customers other than a new name and logo.	63	1	t
200	be559c7b-c719-4812-a69c-a5ccbfb0ece0	company_milestone	Saratoga Eagle Sales & Service	acquired	Minogue's Beverage Centers (100-year-old company) from Jack Minogue	Jeff Vukelic and his brother Paul purchased 100-year-old Minogue's Beverage Centers last week from Jack Minogue.	70	1	t
201	be559c7b-c719-4812-a69c-a5ccbfb0ece0	family_relation	Paul Vukelic	is_brother_of	Jeff Vukelic	Jeff Vukelic, CEO of Saratoga Eagle, and his brother Paul, who heads the family's Try-It Beverage Distributor out of Buffalo, purchased Minogue's Beverage Centers.	70	1	t
202	be559c7b-c719-4812-a69c-a5ccbfb0ece0	press_quote	Jeff Vukelic	said_in_interview	core values of the family business	We are a fourth generation family-owned business with locations in Western and Eastern New York, built on the core values of 'Will to Win, Trust, Doing the Right Thing, and Fun'.	70	1	t
203	be559c7b-c719-4812-a69c-a5ccbfb0ece0	biographical	Jeff Vukelic	moved_to_Capital_Region_when	early 2000's via Northern Distributing acquisition	Jeff moved to the Capital Region in the early 2000's when they acquired Northern Distributing.	70	1	t
204	be559c7b-c719-4812-a69c-a5ccbfb0ece0	company_milestone	Pivo Partners	was_formed_as_subsidiary_to_acquire	Minogue's Beverage Center	The two formed a new subsidiary of Saratoga Eagle — Pivo Partners — to acquire Minogue's Beverage Center.	65	1	t
205	be559c7b-c719-4812-a69c-a5ccbfb0ece0	business_metric	Saratoga Eagle Sales & Service	biggest_competitor_is	DeCrescente Distributing in Mechanicville	the Minogue Beverages Centers will continue to buy some of their inventory from DeCrescente Distributing in Mechanicville, which is Saratoga Eagle's biggest competitor.	65	1	t
206	be559c7b-c719-4812-a69c-a5ccbfb0ece0	red_flag	Saratoga Eagle Sales & Service	experienced	Christmas Day fire (2021)	Saratoga Eagle back in operation following Christmas Day fire.	71	1	t
207	be559c7b-c719-4812-a69c-a5ccbfb0ece0	company_milestone	Saratoga Eagle Sales & Service	acquired	four Minogue's Beverage Centers and Seneca Beverage	The company acquired four Minogue's Beverage Centers in Saratoga and Warren counties in November before completing the purchase of Seneca Beverage.	71	1	t
208	be559c7b-c719-4812-a69c-a5ccbfb0ece0	company_milestone	Saratoga Eagle Sales & Service	acquired	Plattsburgh Distributing (Budweiser, Rolling Rock, energy drinks distributor)	Saratoga Springs-based Saratoga Eagle Sales & Service is acquiring family owned Plattsburgh Distributing, a distributor of Budweiser, Rolling Rock and energy drinks in the North Country.	72	1	t
209	be559c7b-c719-4812-a69c-a5ccbfb0ece0	press_quote	Jeff Vukelic	said_in_interview	Plattsburgh acquisition synergy	It's a great opportunity to grow our business. It's a family owned business, and we felt a lot of synergy there.	72	1	t
210	be559c7b-c719-4812-a69c-a5ccbfb0ece0	business_metric	Saratoga Eagle Sales & Service	operates_facility	150,000-square-foot facility at 45 Duplainville Road, Saratoga Springs	The company operates out of a 150,000-square-foot facility at 45 Duplainville Road, Saratoga Springs, delivering five million cases of craft beers, domestic and imported alcoholic beverages, wine and spirits, energy drinks to over 2,500 customers.	72	1	t
211	be559c7b-c719-4812-a69c-a5ccbfb0ece0	business_metric	Saratoga Eagle Sales & Service	delivers_volume_to_customers	five million cases to over 2,500 customers	delivering five million cases of craft beers, domestic and imported alcoholic beverages, wine and spirits, energy drinks to over 2,500 customers.	72	1	t
212	be559c7b-c719-4812-a69c-a5ccbfb0ece0	company_milestone	Saratoga Eagle Sales & Service	was_founded_in	1933	Saratoga Eagle Sales & Service is also a family owned and operated business founded in 1933.	72	1	t
213	be559c7b-c719-4812-a69c-a5ccbfb0ece0	press_quote	Jeff Vukelic	said_in_interview	Reflective leadership / surrounding self with smarter people	If you talk to most leaders, they surround themselves with people who are smarter than they are,	55	1	t
214	be559c7b-c719-4812-a69c-a5ccbfb0ece0	press_quote	Jeff Vukelic	said_in_interview	always looking to get better through education and learning from others	always looking to get better through education and learning from others.	55	1	t
215	be559c7b-c719-4812-a69c-a5ccbfb0ece0	press_quote	Jeff Vukelic	said_in_interview	COVID stakeholder health priority	During COVID, we were happy to have people working, but we have to keep our stakeholders healthy — that's first and foremost.	55	1	t
216	be559c7b-c719-4812-a69c-a5ccbfb0ece0	biographical	Jeff Vukelic	graduated_from	Hobart and William Smith Colleges, Class of 1988	Jeff Vukelic '88: What Would Dad Do?	55	1	t
217	be559c7b-c719-4812-a69c-a5ccbfb0ece0	biographical	Jeff Vukelic	describes_self_as	lifelong student of leadership	A lifelong "student of leadership," he turns to his business coach, his peers, his employees and the examples his father and grandfather set as they guided the company through the Great Depression, World War II and the beverage industry's evolution during the 20th century.	55	1	t
218	be559c7b-c719-4812-a69c-a5ccbfb0ece0	media_appearance	Jeff Vukelic	was_featured_in	Pulteney Street Survey, HWS Alumni Magazine, Spring 2021	Jeff Vukelic '88: What Would Dad Do?	55	1	t
219	be559c7b-c719-4812-a69c-a5ccbfb0ece0	media_appearance	Eugene P. "Gene" Vukelic	was_subject_of	Buffalo Business First obituary article August 5, 2025	Try-It Distributing Chairman Gene Vukelic dies at 94	57	1	t
220	be559c7b-c719-4812-a69c-a5ccbfb0ece0	media_appearance	Eugene P. "Gene" Vukelic	was_profiled_by	Buffalo Spree feature 'The Beerfather: Gene Vukelic'	The Beerfather: Gene Vukelic	59	1	t
221	be559c7b-c719-4812-a69c-a5ccbfb0ece0	red_flag	Saratoga Eagle Sales & Service Inc.	was_sued_in	Pitta v. Saratoga Eagle Sales & Service Inc. (3:25-ap-02203), NJ Bankruptcy Court, Oct 12, 2025	Adversary case 25-02203 Complaint by Thomas A. Pitta against Saratoga Eagle Sales & Service Inc.. Fee Amount $ 350.. (12 (Recovery of money/property - 547 preference)) filed by Plaintiff Thomas A. Pitta.	69	1	t
222	be559c7b-c719-4812-a69c-a5ccbfb0ece0	red_flag	Saratoga Eagle Sales & Service Inc.	has_pretrial_hearing_on	December 22, 2025 at MBK - Courtroom 8, Trenton	Pre-Trial hearing to be held on 12/22/2025 at 11:00 AM at MBK - Courtroom 8, Trenton.	69	1	t
223	be559c7b-c719-4812-a69c-a5ccbfb0ece0	company_milestone	Saratoga Eagle Sales & Service	is_described_as	fourth-generation, family-owned beverage company	Now, steering the fourth-generation, family-owned beverage company through the pandemic, he reflects on the key lessons that have guided the business in safety, success and good spirits.	55	1	t
224	be559c7b-c719-4812-a69c-a5ccbfb0ece0	family_relation	Jeff Vukelic	is_son_of	Eugene P. "Gene" Vukelic	the examples his father and grandfather set as they guided the company through the Great Depression, World War II and the beverage industry's evolution during the 20th century.	55	0.6	t
225	be559c7b-c719-4812-a69c-a5ccbfb0ece0	press_quote	Jeff Vukelic	said_in_interview	Plattsburgh Distributing acquisition rationale	It's a great opportunity to grow our business,	72	1	t
226	be559c7b-c719-4812-a69c-a5ccbfb0ece0	company_milestone	Try-It Distributing	is_one_of	three major beer distributors in Buffalo	How did Try-It manage to become one of three major beer distributors in Buffalo when, back in 1960 when Gene Vukelic joined his father in [the business]...	59	1	t
340	527c6236-4192-4b05-8715-3d11a0942b6d	company_milestone	Elliot B. Maisel	acquired_company	FIN Branding Group LLC (electronic cigarette company), February 2011	Two years after acquiring a fledgling electronic cigarette company, Mobile's Elliot Maisel sits poised to parlay a lifetime of distribution expertise into his share of a projected $1 billion market.	147	1	t
341	527c6236-4192-4b05-8715-3d11a0942b6d	press_quote	Elliot B. Maisel	said_in_interview	I've been building brands all my life as a distributor	I've been building brands all my life as a distributor, and what we've done here is take beer branding to the cigarette market.	147	1	t
342	527c6236-4192-4b05-8715-3d11a0942b6d	company_milestone	Rebecca L. Maisel	elected_to_role	NBWA Board Chair (2024)	Gulf Distributing SVP Rebecca Maisel made a rallying cry for beer distributors to get energized and invest in their businesses during her first speech as National Beer Wholesalers Association (NBWA) chair on Tuesday at the trade group's annual gathering.	148	1	t
343	527c6236-4192-4b05-8715-3d11a0942b6d	media_appearance	Rebecca L. Maisel	spoke_at_event	NBWA 87th Annual Convention	About 1,700 industry members attended the 87th Annual Convention, with the Product Showcase housing 150 booths.	148	1	t
344	527c6236-4192-4b05-8715-3d11a0942b6d	biographical	Rebecca L. Maisel	previous_industry_roles	chair of NBWA's Next Generation Group; chair of Alabama Wholesale Beer Association; eight years on NBWA's Management Committee	Maisel previously served as chair of the NBWA's Next Generation Group and chair of the Alabama Wholesale Beer Association, and spent eight years on the NBWA's Management Committee.	148	1	t
345	527c6236-4192-4b05-8715-3d11a0942b6d	press_quote	Rebecca L. Maisel	said_in_speech	there is room at the very top of this industry for qualified emerging leaders	Having this board elect me to the officer corps of NBWA three years ago, running the chairs and standing here today as your chair, sends a message to our membership and to the beverage world that there is room at the very top of this industry for qualified emerging leaders who demonstrate passion and commitment to our mission.	148	1	t
346	527c6236-4192-4b05-8715-3d11a0942b6d	family_relation	Rebecca L. Maisel	is_granddaughter_of	Freida G. Maisel	My grandmother, Freida Maisel, founded Gulf Distributing back in 1973, and I always knew I wanted to be a beer distributor and part of our family business.	149	1	t
347	527c6236-4192-4b05-8715-3d11a0942b6d	press_quote	Rebecca L. Maisel	said_in_press_release	I always knew I wanted to be a beer distributor and part of our family business	My grandmother, Freida Maisel, founded Gulf Distributing back in 1973, and I always knew I wanted to be a beer distributor and part of our family business. I am proud to take my family's legacy of serving our industry to a national stage.	149	1	t
348	527c6236-4192-4b05-8715-3d11a0942b6d	business_metric	Gulf Distributing	operates_in_states	Alabama, Florida and Mississippi	As the Senior Vice President of Legal and Government Affairs at Gulf Distributing, she represents a third-generation family business based in Mobile, Alabama serving customers in Alabama, Florida and Mississippi.	149	1	t
349	527c6236-4192-4b05-8715-3d11a0942b6d	media_appearance	Rebecca L. Maisel	spoke_on_panel	BREW Leadership Forum multi-generational leadership panel with father Elliot Maisel	Maisel helped bring the day's themes to life during a powerhouse opening panel on multi-generational leadership, joining her father Elliot Maisel and two other father-daughter distributor leadership teams: Lauren Doll-Sheeder and Mark Doll (Doll Distributing) and Sarah Matesich and Jim Matesich (Matesich Distributing).	150	1	t
375	687fa905-ed54-4dcb-94a7-e782c839f030	quote	Gary Wolfe	\N	Gary Wolfe, COO, Empire Distributors (Feb 2026)	We are excited to welcome McCormick Distilling Company's top-notch brands to the Empire Colorado family.	190	0.9	t
376	687fa905-ed54-4dcb-94a7-e782c839f030	quote	Keith Beattie	\N	Keith Beattie, International Sales Director, Franklin & Sons (Jan 2025)	Empire's exceptional reach and commitment to quality make them an ideal partner as we continue to grow in the U.S. market.	192	0.9	t
350	527c6236-4192-4b05-8715-3d11a0942b6d	family_relation	Rebecca L. Maisel	is_daughter_of	Elliot B. Maisel	Maisel helped bring the day's themes to life during a powerhouse opening panel on multi-generational leadership, joining her father Elliot Maisel and two other father-daughter distributor leadership teams	150	1	t
351	527c6236-4192-4b05-8715-3d11a0942b6d	press_quote	Rebecca L. Maisel	said_at_BREW_forum	leaders from across roles, generations and perspectives who are invested in getting better together	What I love about looking around this room is that it reflects the workforce we're building — leaders from across roles, generations and perspectives who are invested in getting better together.	150	1	t
352	527c6236-4192-4b05-8715-3d11a0942b6d	company_milestone	Freida G. Maisel	received_posthumous_award	Inaugural Freida G. Maisel Businesswoman of the Year Award (Mobile Chamber)	In a poignant tribute, the inaugural Freida G. Maisel Businesswoman of the Year Award was posthumously presented to its namesake, Freida Maisel, with her son, Elliot Maisel, accepting the honor on her behalf.	151	1	t
353	527c6236-4192-4b05-8715-3d11a0942b6d	press_quote	Mobile Chamber	described_Freida_Maisel_as	a beacon of inspiration for aspiring businesswomen everywhere	We are privileged to inaugurate the Freida G. Maisel Businesswoman of the Year Award and pay homage to Mrs. Maisel's enduring legacy. Her remarkable achievements serve as a beacon of inspiration for aspiring businesswomen everywhere.	151	1	t
354	527c6236-4192-4b05-8715-3d11a0942b6d	company_milestone	Gulf Distributing	acquired	Supreme Beverage (Schilleci family Birmingham distributorship) — merger with stock	The Floribama Beer King, which is what I call Elliot Maisel, much to his dismay I'm sure, and his Gulf Distributing, a Blue/Silver house in Alabama, has a deal to acquire the remaining distribution assets of the Schilleci family's Birmingham-based distributorship, Supreme Beverage -- but with a twist. Members of the Schilleci family will take stock in Gulf, making it a merger of sorts.	158	1	t
355	527c6236-4192-4b05-8715-3d11a0942b6d	press_quote	Beer Business Daily	nicknamed_Elliot_Maisel	The Floribama Beer King	The Floribama Beer King, which is what I call Elliot Maisel, much to his dismay I'm sure.	158	1	t
356	527c6236-4192-4b05-8715-3d11a0942b6d	business_metric	Gulf Distributing	annual_gross_revenue	approximately $750 million	Gulf was pegged by the Wall Street Journal at roughly $750 million in gross revenue per year.	159	1	t
357	527c6236-4192-4b05-8715-3d11a0942b6d	business_metric	Gulf Distributing	supplier_count	more than 100 suppliers led by Molson Coors, Constellation, and Boston Beer	Gulf Distributing has more than 100 suppliers, led by Molson Coors, Constellation, and Boston Beer — with big growers like Surfside, Garage Beer, Red Bull, and even some hemp THC rounding things out.	159	1	t
358	527c6236-4192-4b05-8715-3d11a0942b6d	press_quote	Rebecca L. Maisel	headline_quote	We're Never Done Chasing	We're Never Done Chasing	159	1	t
359	527c6236-4192-4b05-8715-3d11a0942b6d	biographical	Elliot B. Maisel	career_origin	began career working in mother's beverage distribution company and father's real estate firm	A Mobile native, Maisel began his career working in his mother's beverage distribution company and his father's real estate firm.	160	1	t
360	527c6236-4192-4b05-8715-3d11a0942b6d	business_metric	Gulf Distributing Holdings	employee_count	more than 1,300 people across Alabama, Florida and Mississippi	Today he leads Gulf Distributing Holdings, which employs more than 1,300 people across Alabama, Florida and Mississippi and represents more than 120 beverage suppliers.	160	1	t
361	527c6236-4192-4b05-8715-3d11a0942b6d	company_milestone	Elliot B. Maisel	made_philanthropic_gift	transformational gift in 2024 to Whiddon College of Medicine for new education and research building	In 2024, he made a transformational gift supporting a new education and research building for the Whiddon College of Medicine.	160	1	t
362	527c6236-4192-4b05-8715-3d11a0942b6d	company_milestone	Elliot B. Maisel	received_award	MolsonCoors Legend (2023) — highest honor for distributor partners	His industry leadership has also been widely recognized, including being named a MolsonCoors Legend in 2023, the company's highest honor for distributor partners.	160	1	t
363	527c6236-4192-4b05-8715-3d11a0942b6d	red_flag	Gulf Distributing Company of Mobile, LLC	was_defendant_in_lawsuit	FLSA overtime suit by former Driver Helper Jawarren Hector (S.D. Ala., 2018)	Plaintiff, Jawarren Hector, by and through counsel, brought this action against his former employer, Gulf Distributing Company of Mobile, LLC. Hector contended that Gulf Distributing violated the Fair Labor Standards Act, 29 U.S.C. §§ 201 et seq. ('FLSA'), by failing to pay him overtime compensation as required by the statute.	161	1	t
364	527c6236-4192-4b05-8715-3d11a0942b6d	company_milestone	Gulf Distributing Holdings	selected_technology_partner	Ohanafy AI-powered beverage operating platform (March 2026)	Gulf Distributing Holdings, LLC, a premier beverage wholesaler with more than 50 years of market leadership, and Ohanafy, the AI-powered operating platform built exclusively for the beverage industry, today announced a strategic partnership to modernize Gulf's enterprise technology infrastructure.	162	1	t
365	527c6236-4192-4b05-8715-3d11a0942b6d	press_quote	Elliot B. Maisel	said_in_press_release	This investment reflects our commitment to our mission of being future-focused	This investment reflects our commitment to our mission of being future-focused. Modernizing our technology infrastructure is a commitment not only to our employees' efficiency and quality of life, but it also ensures we remain a relevant strategic partner for our suppliers and a reliable resource for our retail customers for decades to come.	162	1	t
366	527c6236-4192-4b05-8715-3d11a0942b6d	press_quote	Elliot B. Maisel	said_in_press_release	When Gulf was founded in 1973, my mother and I had about 15 employees and a few trucks	When Gulf was founded in 1973, my mother and I had about 15 employees and a few trucks. The Moffett Road location was a perfect fit for Gulf back then and had plenty of room for our thriving business to grow.	163	1	t
367	527c6236-4192-4b05-8715-3d11a0942b6d	business_metric	Gulf Distributing Holdings	service_territory	entire state of Alabama, two regional areas in Mississippi, and the Florida panhandle	Family-driven for fifty years, Gulf Distributing Holdings currently operates several distribution companies that service the entire state of Alabama, two regional areas in Mississippi, and the Florida panhandle.	163	1	t
368	527c6236-4192-4b05-8715-3d11a0942b6d	biographical	Freida G. Maisel	family_origin	mother from Lithuania; father from border between Poland and Russia	Her mother was from Lithuania and her father was from the border between Poland and Russia.	144	1	t
369	527c6236-4192-4b05-8715-3d11a0942b6d	company_milestone	Freida G. Maisel	joined_organization	Committee of 200 (national organization of prominent businesswomen)	Freida became a member of the Committee of 200, a national organization of prominent businesswomen.	142	1	t
370	527c6236-4192-4b05-8715-3d11a0942b6d	media_appearance	Rebecca L. Maisel	currently_holds_role	Gulf Distributing Holdings Chief Corporate Strategy Officer; BREW Advisory Board Member; Immediate Past Chair of NBWA	said Rebecca Maisel, Gulf Distributing Holdings Chief Corporate Strategy Officer, BREW Advisory Board Member and Immediate Past Chair of NBWA.	150	1	t
377	f9a78f4a-c9e8-439b-9d26-13a407aec584	quote	Bill Bessette	\N	Bill Bessette, Chief Strategy Officer — Beverage Industry, 2016	Today, we have 1,850 employees and operate more than 400 trucks, providing service to 25,000 customers.	203	0.9	t
378	f9a78f4a-c9e8-439b-9d26-13a407aec584	quote	Manhattan Beer leadership — Beverage Industry	\N	Manhattan Beer leadership — Beverage Industry, 2016	We are moving toward 100 percent use of CNG. The Bronx, where our headquarters is located, has one of the highest rates of asthma in the country, and the move to CNG helped reduce air pollution.	205	0.9	t
\.


--
-- Data for Name: intel; Type: TABLE DATA; Schema: research; Owner: evgenyarol
--

COPY research.intel (distributor_id, legal_name, dba, state, website, founded_year, employee_count, account_count, primary_supplier, brands_json, score, tier, red_flag_severity, founding_moment, summary, updated_at) FROM stdin;
687fa905-ed54-4dcb-94a7-e782c839f030	EMPIRE DISTRIBUTORS, INC.	EMPIRE	GA	https://empiredist.com/	1940	1600	\N	Broadline spirits, wine & beer (4,500+ brands)	["Holladay Bourbon", "Five Farms Irish Cream", "Franklin & Sons", "Volio Imports", "Triple Dog Irish Whiskey"]	8	A	medium	In 1940, Max E. Kahn purchased Fulton Distributors in Atlanta and launched Empire with two trucks, eight brands and 149 accounts.	One of the largest privately run beverage-alcohol distributors in the U.S. Southeast and Mountain West. Founded in 1940 by Max E. Kahn and run today by the third-generation Kahn family (President & CEO David Kahn and SVP Michael Kahn); owned since 2010 by Berkshire Hathaway's McLane Company via parent Kahn Ventures. ~1,600 employees and 4,500+ spirits, wine and beer brands across roughly 14 facilities in Georgia, North Carolina, Tennessee and Colorado.	2026-05-08 04:42:02.877134+02
be559c7b-c719-4812-a69c-a5ccbfb0ece0	Saratoga Eagle Sales & Service, Inc.	Saratoga Eagle	NY	https://saratogaeagle.com	1933	180	2500	Anheuser-Busch InBev	["Budweiser", "Michelob", "Labatt", "Rolling Rock", "Red Bull", "Arizona"]	8	A	medium	Vukelic started bottling soft drinks in his native Lackawanna, New York in 1928, at age 27, to meet the demand of thirsty Western New Yorkers during prohibition.	Saratoga Eagle Sales & Service is a family-owned Anheuser-Busch InBev beer and beverage wholesaler headquartered in Saratoga Springs, NY, formerly known as Northern Distributing (founded 1933) and acquired in 2005 by the Vukelic family of Buffalo-based Try-It Distributing (founded 1928). Operating from a 150,000-square-foot facility with ~180 stakeholders, it delivers roughly 5 million cases of craft, domestic and imported beer, wine, spirits, soft drinks, water and energy drinks to over 2,500 customers across upstate New York, having expanded through acquisitions including Plattsburgh Distributing (2019), Northern Eagle Beverages (Oneonta) and Seneca Beverage (Elmira) in 2022, and Minogue's Beverage Centers.	2026-05-08 06:40:45.110415+02
527c6236-4192-4b05-8715-3d11a0942b6d	Gulf Distributing Holdings, LLC	Gulf Distributing Company	AL	https://gulfdistributing.com	1973	1200	10000	Molson Coors / Miller	["Miller Lite", "Coors", "Red Bull", "Murder Creek"]	9	A	medium	In 1973, Freida bought a small beverage wholesaler in Mobile, renamed it Gulf Distributing Company, and built the foundation of a business that now serves customers in six states and employs nearly 2,000 people.	Gulf Distributing Holdings is a family-owned, full-service beer and beverage distributor headquartered in Mobile, Alabama, founded in 1973 by former schoolteacher Freida G. Maisel. Through six operating subsidiaries—Gulf Distributing of Mobile, Gulf Distributing of Alabama (Birmingham/Huntsville), Allstate Beverage (Central AL), Energy Beverage Management (MS), and Goldring Gulf Distributing (NW FL)—it serves over 10,000 retail accounts across Alabama, the Florida panhandle, and southern/central Mississippi with more than 1,200 employees representing 100+ suppliers and 1,000+ brands.	2026-05-08 21:44:12.193819+02
99fd34ba-42fc-4c5d-89d6-cbf3926e013f	Doll Distributing, LLC	Doll Distributing	IA	https://www.dolldistributing.com/	1965	480	2000	Anheuser-Busch	["Anheuser-Busch", "Budweiser", "Pabst Blue Ribbon", "Grain Belt", "Surly Brewing Company", "Avery Brewing Company", "Big Sipz", "Exile Brewing", "Odell Brewing Company", "Big Grove"]	7	B	\N	\N	Doll Distributing is a third-generation, family-owned beverage distributor founded in 1965 by Merlin and Edith Doll, headquartered in Des Moines, Iowa. The company distributes beer, wine, spirits and non-alcoholic beverages, primarily as an Anheuser-Busch wholesaler, across Iowa and Minnesota, with recent expansions (2025-2026) into South Dakota and North Dakota via acquisitions of Ellwein Brothers, John A. Conkling, McQuade Distributing and Valley Distributing. It operates from facilities in Des Moines, Council Bluffs, Spencer (IA) and Worthington (MN) with around 480 team members.	2026-05-08 20:16:51.52641+02
f9a78f4a-c9e8-439b-9d26-13a407aec584	MANHATTAN BEER DISTRIBUTORS LLC GROUP	MANHATTAN	NY	https://www.manhattanbeer.com/	1978	1850	25000	Constellation (Corona/Modelo) & Molson Coors (Coors Light)	["Corona", "Modelo Especial", "Coors Light", "Heineken", "White Claw"]	8	A	medium	In 1978, Simon Bergson founded Manhattan Beer from a 4,000-sq-ft Bronx warehouse with three trucks and rights to two brands (Carling Black Label and Tuborg).	The largest single-market beer distributor in the United States and fourth-largest U.S. beverage distributor. Founded in 1978 by Simon Bergson, who won the New York Corona contract (1988) and merged with NYC's Coors distributor (1998). ~1,850 employees, 400+ trucks and 45M+ case-equivalents a year across ~350 brands to ~25,000 customers in 14+ counties from five facilities; rebranded to Manhattan Beer & Beverage Distributors in 2025.	2026-05-08 04:55:05.13135+02
\.


--
-- Data for Name: person; Type: TABLE DATA; Schema: research; Owner: evgenyarol
--

COPY research.person (id, distributor_id, full_name, title, role_category, generation, is_decision_maker, is_deceased, death_year, linkedin_url, email, phone, parent_id, spouse_id, parent_name, spouse_name, bio_short, key_facts_json, photo_url, education_json, career_summary, related_article_urls, extra_facts_json, outreach_status, outreach_updated_at, outreach_updated_by, emails, phones, personal_email, twitter_url, github_url, location_text, headline, experience_json) FROM stdin;
57	be559c7b-c719-4812-a69c-a5ccbfb0ece0	Paul Vukelic	President/CEO, Try-It Distributing (parent/affiliate)	owner	3	t	f	\N	https://www.linkedin.com/in/paul-vukelic-68618112	\N	\N	55	\N	Eugene P. "Gene" Vukelic	\N	President/CEO of Try-It Distributing Co., Inc. & Balkan Beverage LLC in Lancaster, NY. Co-owner with brother Jeff of Saratoga Eagle and Minogue's Beverage Centers. Saint Louis University 1979-1983.	[]	https://media.bizj.us/view/img/13191784/paulvukelic-bw-cropped.jpg	[{"year": "1983", "degree": "", "school": "Saint Louis University"}]	Paul Vukelic is President/CEO of Try-It Distributing Co., Inc. and Balkan Beverage LLC in Lancaster, NY, the third-generation Vukelic leader of the family beer-distribution business founded in 1919/1928. With his brother Jeff, he co-owns Saratoga Eagle Sales & Service and, since late 2021, Minogue's Beverage Centers, expanding the family's Anheuser-Busch and Labatt distribution footprint across Western and Upstate New York. He has more recently been identified as Executive Chairman of Try-It Beverage, which serves Niagara and Erie counties.	["https://www.bizjournals.com/buffalo/news/2025/08/05/gene-vukelic-dies-try-it-distributing-chairman.html", "https://www.buffalospree.com/features/the-beerfather-gene-vukelic/article_4d66a417-901b-52bd-b388-35014533ad7e.html", "https://www.saratoga.com/saratogabusinessjournal/2022/01/saratoga-eagle-expands-by-acquiring-distributorships-in-oneonta-and-elmira/", "https://www.glensfallschronicle.com/saratoga-eagle-buys-minogues-beverage-biz-key-2-families-succession/", "https://www.buffalorising.com/2025/08/heaven-gains-a-buffalo-icon-in-business-philanthropy-and-family-in-try-it-distributing-chairman-eugene-p-gene-vukelik/"]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
134	527c6236-4192-4b05-8715-3d11a0942b6d	Diana Wright	Business Systems Manager	other	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Business Systems Manager at Gulf Distributing Holdings.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
135	527c6236-4192-4b05-8715-3d11a0942b6d	Domenic Olson	Senior Vice President - Southern Division	vp_sales	\N	t	f	\N	https://www.linkedin.com/in/domenic-olson-702aa053	\N	\N	\N	\N	\N	\N	Senior Vice President leading Gulf's Southern Division.	["SVP – Southern Division"]	https://gulfdistributing.com/gulfdistributingofmobile/wp-content/uploads/sites/4/2023/07/Domenic-Olson.jpg	[{"year": 1999, "degree": null, "school": "University of South Alabama", "source_url": "https://www.linkedin.com/in/domenic-olson-702aa053"}]	Domenic Olson is Senior Vice President - Southern Division at Gulf Distributing Holdings, the family-owned Mobile, Alabama-based beer and beverage wholesaler founded in 1973. A University of South Alabama graduate with more than two decades in the beverage industry, Olson previously served as Managing Director/General Manager before being elevated as part of the company's company-wide senior leadership restructuring announced alongside plans to add 60+ jobs. He oversees Gulf's southern Alabama and northwest Florida operations within the multi-warehouse footprint serving Alabama, Florida and Mississippi.	["https://baybusinessnews.com/logistics-distribution-maritime/gulf-distributing-adds-jobs-restructures-senior-leadership/", "https://mobilechamber.com/2023/01/gulf-distributing-to-relocate-operations-to-downtown-mobile/"]	[{"fact": "Senior Vice President - Southern Division at Gulf Distributing Holdings, listed on company leadership team page.", "type": "trade_role", "source_url": "https://gulfdistributing.com/team/"}, {"fact": "Previously held title of Managing Director / General Manager at Gulf Distributing prior to senior leadership restructuring.", "type": "trade_role", "source_url": "https://businessalabama.com/gulf-distributing-adding-60-jobs-over-next-year/"}, {"fact": "Has worked in the beverage industry for 23+ years; graduate of the University of South Alabama.", "type": "trade_role", "source_url": "https://businessalabama.com/gulf-distributing-adding-60-jobs-over-next-year/"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
136	527c6236-4192-4b05-8715-3d11a0942b6d	Gaines Johnston	General Counsel	other	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	General Counsel at Gulf Distributing Holdings.	["General Counsel"]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
137	527c6236-4192-4b05-8715-3d11a0942b6d	J. Haas Byrd	Corporate Counsel	other	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Corporate Counsel at Gulf Distributing Holdings.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
193	f9a78f4a-c9e8-439b-9d26-13a407aec584	George Wertheimer	Chief Financial Officer	cfo	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Oversees finance for the ~$640M+ revenue operation.	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
194	f9a78f4a-c9e8-439b-9d26-13a407aec584	Richard Kleberg	Chief People Officer	c_suite	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Leads HR and people functions across ~1,850 employees.	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
195	f9a78f4a-c9e8-439b-9d26-13a407aec584	Juan Corcino	Senior Director, Fleet Operations & Sustainability	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Leads CNG/electric fleet transition; ACT Expo 2025 panelist.	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
58	be559c7b-c719-4812-a69c-a5ccbfb0ece0	Andrew Smith	Director, Sales	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Director of Sales at Saratoga Eagle.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
55	be559c7b-c719-4812-a69c-a5ccbfb0ece0	Eugene P. "Gene" Vukelic	Chairman, Try-It Distributing (parent company)	board	2	f	t	\N	\N	\N	\N	54	\N	Stephen L. Vukelic	\N	Son of founder Stephen Vukelic, joined Try-It Distributing in 1960 and built it into one of Buffalo's major beer distributors. Chairman of Try-It Distributing, the parent company of Saratoga Eagle. Died August 2025 at age 94.	[]	https://www.buffalorising.com/wp-content/uploads/2025/08/Screen-Shot-2025-08-07-at-10.30.12-AM.png	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
150	527c6236-4192-4b05-8715-3d11a0942b6d	Rachael Franklin	Senior HR Operations Manager	other	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Senior HR Operations Manager at Gulf Distributing Holdings.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
151	527c6236-4192-4b05-8715-3d11a0942b6d	Scott Van Matre	Managing Director - Red Bull Chain Sales	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Managing Director of Red Bull Chain Sales at Gulf.	["Leads Red Bull chain sales"]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
152	527c6236-4192-4b05-8715-3d11a0942b6d	Stephen Quina	Director of Financial Services	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Director of Financial Services at Gulf Distributing Holdings.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
153	527c6236-4192-4b05-8715-3d11a0942b6d	Virginia B. Holder	Senior Administrative Assistant	other	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Senior Administrative Assistant at Gulf Distributing Holdings.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
154	527c6236-4192-4b05-8715-3d11a0942b6d	Whitney Rouse	Director of Accounting	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Director of Accounting at Gulf Distributing Holdings.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
176	687fa905-ed54-4dcb-94a7-e782c839f030	Max E. Kahn	Founder	founder	1	t	t	\N	\N	\N	\N	\N	\N	\N	\N	Bought Fulton Distributors in 1940; started Empire with two trucks, eight brands, 149 accounts; served in WWII. Deceased.	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
180	687fa905-ed54-4dcb-94a7-e782c839f030	Jim Schwarzkopf	EVP & CFO	cfo	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	Accounting degree, University of Northern Iowa; joined Empire in 1986.	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
177	687fa905-ed54-4dcb-94a7-e782c839f030	Roger Kahn	Owner / Leader	owner	2	t	f	\N	\N	\N	\N	176	\N	Max E. Kahn	\N	Second-generation Kahn who led and grew Empire before the 1998 transition to his sons.	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
178	687fa905-ed54-4dcb-94a7-e782c839f030	David Kahn	President & CEO	ceo	3	t	f	\N	https://www.linkedin.com/company/empire-distributors-inc-	\N	\N	177	\N	Roger Kahn	\N	Grandson of founder Max Kahn; acquired the company with brother Michael in 1998; oversees company-wide operations.	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
179	687fa905-ed54-4dcb-94a7-e782c839f030	Michael Kahn	Senior Vice President	vp	3	f	f	\N	\N	\N	\N	177	\N	Roger Kahn	\N	Grandson of founder Max Kahn; co-acquired Empire in 1998; senior executive across the multi-state operation.	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
181	687fa905-ed54-4dcb-94a7-e782c839f030	Gary Wolfe	VP & COO	coo	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	10 years at E&J Gallo and 3 at Johnson Brothers before joining the Kahn Ventures network.	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
182	687fa905-ed54-4dcb-94a7-e782c839f030	Bill MacPhail	VP & CIO	vp	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	30+ years in IT, specializing in product and software development.	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
183	687fa905-ed54-4dcb-94a7-e782c839f030	Wendy Lewis	VP, Marketing & Communications	vp	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Leads marketing and communications.	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
184	687fa905-ed54-4dcb-94a7-e782c839f030	Brian Graeser	President, Empire Distributors of Georgia	president	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Runs Georgia operations from the Austell HQ.	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
185	687fa905-ed54-4dcb-94a7-e782c839f030	Patrick Stephenson	President, Empire Distributors of Tennessee	president	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Leads Tennessee operations from Nashville.	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
186	687fa905-ed54-4dcb-94a7-e782c839f030	David Beyer	President, Empire Distributors of Colorado	president	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Leads Colorado operations from Denver.	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
61	be559c7b-c719-4812-a69c-a5ccbfb0ece0	E.J. Harkins	Vice President, Sales and Marketing	vp_sales	\N	t	f	\N	https://www.linkedin.com/in/ej-harkins-b4304923	\N	518-581-7377	\N	\N	\N	\N	VP of Sales and Marketing at Saratoga Eagle Sales & Service. Chairman of Saratoga Convention & Tourism Bureau Board; VP of Unlimited Potential Board.	[]	\N	[{"year": "", "degree": "Alumnus", "school": "Leadership Saratoga"}]	E.J. Harkins serves as Vice President of Sales and Marketing (also referenced as VP/General Manager) at Saratoga Eagle Sales & Service in Saratoga Springs, NY, leading the distributor's sales and marketing organization through a period of significant territorial expansion. He is deeply embedded in the Saratoga business community, serving as Chairman of the Saratoga Convention & Tourism Bureau Board and Vice President of the Unlimited Potential Board, and previously as President of the Rebuilding Together Saratoga County Board of Directors. He is a Leadership Saratoga alumnus and has been involved with Rebuilding Together since 2008.	["https://www.saratoga.com/saratogabusinessjournal/2022/01/saratoga-eagle-expands-by-acquiring-distributorships-in-oneonta-and-elmira/", "https://www.saratoga.com/saratogabusinessjournal/2020/02/saratoga-eagles-sales-and-service-growth-leads-to-plans-to-expand-its-warehouse/", "https://www.bizjournals.com/albany/news/2022/01/19/saratoga-eagle-up-and-running-after-fire.html", "https://www.glensfallschronicle.com/saratoga-eagle-buys-minogues-beverage-biz-key-2-families-succession/"]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
111	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	Scott Doll	Owner (2nd Generation)	owner	2	t	f	\N	\N	\N	\N	107	\N	Merlin G. Doll	Liz Doll	Member of the second generation that purchased Doll Distributing from founders Merlin and Edith Doll in 1987.	["Part of 1987 second-generation buyout", "Listed in founder's obituary as son"]	\N	[]	Scott Doll is part of the second generation of the Doll family that purchased Doll Distributing from founders Merlin and Edith Doll in 1987, alongside siblings Jeff, Mark, Tami, and Jay. Under their leadership, the Council Bluffs, Iowa-based Anheuser-Busch wholesaler expanded from three to dozens of counties through acquisitions including Red Oak (1988), Nesbit Distributing in Des Moines (2006), Grinnell Beverage (2007), Whittenburg and Kabrick (2010), and into Minnesota, South Dakota, and North Dakota. Today Scott continues to share ownership of Doll Distributing as the family transitions leadership to the third generation.	["https://www.dolldistributing.com/about", "https://www.dolldistributing.com/about/the-doll-team", "https://www.mydigitalpublication.com/article/A+Third+Generation+Family+Business/4863971/832638/article.html", "https://www.businessrecord.com/doll-distributing-a-legacy-of-success-in-the-heart-of-iowa/"]	[{"fact": "Co-owner of Doll Distributing, an Anheuser-Busch wholesaler headquartered in Council Bluffs/Des Moines, Iowa, that purchased the family business from founders Merlin and Edith Doll in 1987.", "type": "trade_role", "source_url": "https://www.dolldistributing.com/about"}, {"fact": "Identified as a co-owner of Doll Distributing alongside his brother in a Council Bluffs city agenda exhibit letter on behalf of the company.", "type": "trade_role", "source_url": "https://councilbluffs.novusagenda.com/agendapublic//AttachmentViewer.ashx?AttachmentID=8747&ItemID=4417"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
54	be559c7b-c719-4812-a69c-a5ccbfb0ece0	Stephen L. Vukelic	Founder	founder	1	f	t	\N	\N	\N	\N	\N	\N	\N	\N	Founder of Try-It Distributing (parent company of Saratoga Eagle); started bottling soft drinks in Lackawanna, NY in 1928 at age 27, fondly known as 'The Chief.' Added Budweiser and Michelob in 1946 and Labatt in 1949.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
59	be559c7b-c719-4812-a69c-a5ccbfb0ece0	Chip Camarro	Director, Customer Service	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Director of Customer Service at Saratoga Eagle.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
60	be559c7b-c719-4812-a69c-a5ccbfb0ece0	David Glastetter	Executive (per ZoomInfo directory)	other	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Listed in Saratoga Eagle employee directory.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
62	be559c7b-c719-4812-a69c-a5ccbfb0ece0	Jamie Bell	Director, Operations	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Director of Operations at Saratoga Eagle.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
63	be559c7b-c719-4812-a69c-a5ccbfb0ece0	Jeff Franey	Sales Director	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Sales Director at Saratoga Eagle.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
112	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	Tami Doll	Vice President	vp_ops	2	t	f	\N	https://www.linkedin.com/in/tami-doll-5a765620	\N	\N	107	\N	Merlin G. Doll	\N	Vice President of Doll Distributing; member of the second generation that bought the business in 1987.	["Vice President per The Org and LinkedIn", "Part of 1987 second-generation buyout"]	\N	[{"year": null, "degree": null, "school": "Iowa Western Community College", "source_url": "https://www.linkedin.com/in/tami-doll-5a765620"}]	Tami Doll is Vice President of Doll Distributing, LLC, a family-owned beverage distributor based in Council Bluffs, Iowa. In 1987, she and her siblings—Jeff, Mark, Scott, and Jay Doll—purchased the business from their parents Merlin and Edith Doll, who founded the company in 1965. As part of the second generation, she helped grow the distributorship from three counties to 44 Iowa counties and 8 Minnesota counties through acquisitions including Nesbit Distributing (2006), Grinnell Beverage (2007), and Whittenburg/Kabrick Distributing (2010). Today she works alongside the third generation of the Doll family at the company.	[]	[{"fact": "Member of the second generation of the Doll family that purchased Doll Distributing from founders Merlin and Edith Doll in 1987.", "type": "trade_role", "source_url": "https://www.dolldistributing.com/about"}, {"fact": "Based in Council Bluffs, Iowa, where Doll Distributing is headquartered.", "type": "trade_role", "source_url": "https://rocketreach.co/tami-doll-email_34164956"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
56	be559c7b-c719-4812-a69c-a5ccbfb0ece0	Jeff Vukelic	Owner, President & CEO	ceo	3	t	f	\N	https://www.linkedin.com/in/jeff-vukelic-79482811	Jeff.vukelic@saratogaeagle.com	(518) 580-3120	55	\N	Eugene P. "Gene" Vukelic	\N	Owner, President and CEO of Saratoga Eagle Sales & Service. Previously Executive VP at Try-It Distributing in Buffalo before moving east in 2005 to run the newly acquired Saratoga Eagle. Hobart and William Smith Colleges '88. Serves on numerous community boards including Saratoga Performing Arts Center and AIM Services.	[]	https://www.hws.edu/images/alum/pssspring21/vukelic.jpeg	[{"year": "1984 – 1988", "degree": "BS, Economics", "school": "Hobart and William Smith Colleges", "activities": "Cross Country Team"}, {"year": "1980 – 1984", "degree": null, "school": "Canisius High School"}]	Jeff Vukelic is President and CEO of Saratoga Eagle Sales & Service, a family-owned subsidiary of Buffalo-based Try-It Distributing, founded by his grandfather. He joined Try-It in 1991, working his way up through warehouse, sales, IT, and strategic planning roles before serving as Executive Vice President (2001-2005), then relocated to Saratoga Springs in 2005 to lead the newly acquired Saratoga Eagle, which now distributes more than five million cases annually across northeastern New York. Under his leadership the company has grown through acquisitions including Ruch (2010), Minogue's Beverage (2019), and distributorships in Oneonta and Elmira (2022). He was named to Buffalo Business First's Forty Under 40 in 2002.	["https://www.hws.edu/alum/pssSpring21/vukelic.aspx", "https://www.saratoga.com/saratogabusinessjournal/2022/01/saratoga-eagle-expands-by-acquiring-distributorships-in-oneonta-and-elmira/", "https://www.saratoga.com/saratogabusinessjournal/2020/02/saratoga-eagles-sales-and-service-growth-leads-to-plans-to-expand-its-warehouse/", "https://www.glensfallschronicle.com/saratoga-eagle-buys-minogues-beverage-biz-key-2-families-succession/", "https://www.bizjournals.com/albany/news/2022/01/19/saratoga-eagle-up-and-running-after-fire.html"]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	[{"dates": "Sep 2005 – Present · 20 yrs 10 mos", "title": "Owner / President", "company": "Saratoga Eagle Sales & Service", "description": null}, {"dates": "Jan 1988 – Jan 1990 · 2 yrs 1 mo", "title": "District Director for Congressman Bill Paxon", "company": "U.S. House of Representatives", "description": "Assisted in constituent services and represented the Congressman at area events."}]
64	be559c7b-c719-4812-a69c-a5ccbfb0ece0	John Fisher	President	president	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	President of Saratoga Eagle Sales & Service.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
66	be559c7b-c719-4812-a69c-a5ccbfb0ece0	Robert Rodriguez	Director, Field Sales	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Director of Field Sales at Saratoga Eagle.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
67	be559c7b-c719-4812-a69c-a5ccbfb0ece0	Tom Hanlon	Director, Sales Operations	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Director of Sales Operations at Saratoga Eagle.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
65	be559c7b-c719-4812-a69c-a5ccbfb0ece0	Kevin O'Rourke	Vice President, Operations	vp_ops	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	Vice President of Operations at Saratoga Eagle Sales & Service.	[]	\N	[]	Kevin O'Rourke is associated with Saratoga Eagle Sales & Service in Saratoga Springs, NY, where third-party business directories have listed him in roles including Director of Category Management and Key Account Manager. Public sources do not independently confirm a Vice President, Operations title.	["https://www.saratoga.com/saratogabusinessjournal/2022/01/saratoga-eagle-expands-by-acquiring-distributorships-in-oneonta-and-elmira/", "https://www.saratoga.com/saratogabusinessjournal/2020/02/saratoga-eagles-sales-and-service-growth-leads-to-plans-to-expand-its-warehouse/", "https://www.bizjournals.com/albany/news/2022/01/19/saratoga-eagle-up-and-running-after-fire.html", "https://www.glensfallschronicle.com/saratoga-eagle-buys-minogues-beverage-biz-key-2-families-succession/"]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
106	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	Edith Doll	Co-Founder	founder	1	f	t	\N	\N	\N	\N	\N	107	\N	Merlin G. Doll	Co-founder of Doll Distributing in 1965 with husband Merlin Doll. Maiden name Parr.	["Co-founded Doll Distributing in 1965", "Predeceased husband Merlin"]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
107	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	Merlin G. Doll	Founder	founder	1	f	t	\N	\N	\N	\N	\N	106	\N	Edith Doll	Co-founder of Doll Distributing in 1965 with his wife Edith. Previously sales manager at Storz Brewing in Omaha, NE; bought Simmons Distributing in Hastings, NE then Michaels Distributing in Council Bluffs, IA. Sold the business to his children (the second generation) in 1987.	["Co-founded Doll Distributing in 1965", "Worked at Storz Brewing Company in Omaha, NE before founding the company", "Sold the company to second-generation children in 1987", "Died 2017, age 79, in Paradise Valley, AZ"]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
187	f9a78f4a-c9e8-439b-9d26-13a407aec584	Simon Bergson	Founder, President & CEO	founder	1	t	f	\N	https://www.linkedin.com/in/simon-bergson-51278a1a/	\N	\N	\N	\N	\N	\N	'New York's beer king'; founded the company in 1978, won Corona (1988) and merged with the Coors distributor (1998); Brooklyn Jewish Hall of Fame inductee (2016).	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
188	f9a78f4a-c9e8-439b-9d26-13a407aec584	Mitchel Bergson	Chief Transition Officer	c_suite	1	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Son of Simon Bergson; principal of MBBD overseeing generational transition.	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
190	f9a78f4a-c9e8-439b-9d26-13a407aec584	Bill Bessette	Chief Strategy Officer	c_suite	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Strategy lead; former chairman, New York State Beer Wholesalers' Association.	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
191	f9a78f4a-c9e8-439b-9d26-13a407aec584	Edward (Ed) McBrien	Chief Operations Officer	coo	\N	t	f	\N	\N	\N	\N	\N	\N	\N	\N	Operations chief; formerly president of sales & distributor operations at MillerCoors.	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
192	f9a78f4a-c9e8-439b-9d26-13a407aec584	William (Bill) DeLuca	Chief Commercial Officer	c_suite	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Leads commercial and supplier relationships.	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
189	f9a78f4a-c9e8-439b-9d26-13a407aec584	Alex Bergson	Vice President / Successor	vp	2	f	f	\N	https://www.linkedin.com/in/alex-bergson-5005bb33/	\N	\N	187	\N	Simon Bergson	\N	Son of Simon Bergson and designated next-generation successor; previously Director of Development & Innovation.	\N	\N	\N	\N	\N	\N	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
113	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	Andrew Doll	Owner / Third-Generation Family Member	heir	3	t	f	\N	https://www.linkedin.com/in/andrew-doll-03493931	\N	\N	\N	\N	\N	\N	Third-generation Doll family member active in the business; pictured promoting the company's anti-human-trafficking truck-wrap initiative with the Iowa Secretary of State.	["Listed as one of four third-generation members in the business", "Pictured at IBAT/anti-human-trafficking event"]	\N	[{"year": 2011, "degree": null, "school": "Iowa State University", "source_url": "https://www.linkedin.com/in/andrew-doll-03493931"}]	Andrew Doll is a third-generation member of the Doll family at Doll Distributing, LLC, the Iowa-based Anheuser-Busch wholesaler founded by his grandparents Merlin and Edith Doll in 1965. He attended Iowa State University (2006–2011) and has served as Brand Development Manager, helping pilot Anheuser-Busch's rail-shipped wholesale delivery program with Union Pacific. Alongside cousins Lauren, George, and Gus, he is helping lead the company's transition from the second to the third generation as it expands across Iowa, Minnesota, South Dakota, and North Dakota.	["https://www.businessrecord.com/doll-distributing-a-legacy-of-success-in-the-heart-of-iowa/", "https://www.railwayage.com/freight/class-i/anheuser-busch-up-doll-distributing-partner-for-wholesale-delivery/", "https://www.mydigitalpublication.com/article/A+Third+Generation+Family+Business/4863971/832638/article.html"]	[{"fact": "Serves as Brand Development Manager at Doll Distributing and was quoted in coverage of the Anheuser-Busch / Union Pacific rail-delivered wholesale partnership, citing GPS tracking and reduced product damage during rail shipment.", "type": "trade_role", "source_url": "https://www.railwayage.com/freight/class-i/anheuser-busch-up-doll-distributing-partner-for-wholesale-delivery/"}, {"fact": "Andrew Doll and the Doll family were recognized with the Patriotic Employer Award (announcement shared on Doll Distributing's social channels).", "type": "award", "source_url": "https://www.instagram.com/p/DUTaIEQDQiH/"}, {"fact": "Named as one of four third-generation Doll family members (Andrew, Lauren, George, Gus) entering and growing the business per the company's Doll Team page.", "type": "trade_role", "source_url": "https://www.dolldistributing.com/about/the-doll-team"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
114	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	Charles Doll	Third-Generation Family Member	heir	3	f	f	\N	https://www.linkedin.com/in/charles-doll-253b4016a	\N	\N	\N	\N	\N	\N	Third-generation Doll family member named in Lauren Doll-Sheeder's Ankeny Business Journal article on the third-generation transition.	["Named alongside Andrew, George, Gus and Lauren as 3rd generation in Ankeny Business Journal Oct 2024"]	\N	[{"year": 2023, "degree": null, "school": "Iowa State University", "source_url": "https://www.linkedin.com/in/charles-doll-253b4016a"}]	Charles Doll is a third-generation member of the Doll family at Doll Distributing, the Des Moines, Iowa-based Budweiser wholesaler founded in 1965 by his grandparents Merlin and Edith Doll. He attended Iowa State University from 2018 to 2023 and has joined the family business alongside fellow third-generation members Andrew, Lauren, George, and Gus, who are continuing the company's growth across Iowa, Minnesota, South Dakota, and North Dakota. He is identified in his cousin Lauren Doll-Sheeder's Ankeny Business Journal column as part of the third-generation team carrying on the company motto of 'Building Brands; Building Relationships.'	["https://www.mydigitalpublication.com/article/A+Third+Generation+Family+Business/4863971/832638/article.html", "https://www.businessrecord.com/doll-distributing-a-legacy-of-success-in-the-heart-of-iowa/", "https://www.dolldistributing.com/about/the-doll-team"]	[{"fact": "Third-generation member of the Doll family at Doll Distributing, working alongside Andrew, Lauren, George, and Gus to continue the family business legacy.", "type": "trade_role", "source_url": "https://www.mydigitalpublication.com/article/A+Third+Generation+Family+Business/4863971/832638/article.html"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
115	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	George Doll	Third-Generation Family Member	heir	3	t	f	\N	\N	\N	\N	\N	\N	\N	\N	Third-generation Doll family member active in the business.	["Named as 3rd generation in company history page"]	\N	[{"year": null, "degree": null, "school": "University of Iowa", "source_url": "https://www.facebook.com/p/George-Doll-100004180601778/"}]	George Doll is a third-generation member of the Doll family at Doll Distributing, LLC, the family-owned Iowa beer and beverage distributor founded in 1965 by his grandparents Merlin and Edith Doll. He is listed alongside fellow third-generation family members Andrew, Lauren, and Gus as having entered the business and helping continue its growth, which has expanded into 44 Iowa counties, 8 Minnesota counties, and most recently into South Dakota (2025) and North Dakota (2026). According to public profiles, he is based in the Iowa City/Des Moines area and attended the University of Iowa.	["https://www.dolldistributing.com/about/the-doll-team", "https://www.mydigitalpublication.com/article/A+Third+Generation+Family+Business/4863971/832638/article.html", "https://www.businessrecord.com/doll-distributing-a-legacy-of-success-in-the-heart-of-iowa/", "https://www.linkedin.com/company/doll-distributing-llc"]	[{"fact": "Named on Doll Distributing's official team page as one of the Third Generation family members (Andrew, Lauren, George, and Gus) who have entered the business.", "type": "trade_role", "source_url": "https://www.dolldistributing.com/about/the-doll-team"}, {"fact": "Identified in the Ankeny Business Journal (Oct 2024) as one of the third-generation Dolls — Andrew, George, Gus, Charles, and Lauren — continuing the family beer distribution business founded by grandparents Merlin and Edith Doll.", "type": "trade_role", "source_url": "https://www.mydigitalpublication.com/article/A+Third+Generation+Family+Business/4863971/832638/article.html"}, {"fact": "Public Facebook profile lists him as living in Iowa City, IA, working at Doll Distributing LLC, and attending the University of Iowa.", "type": "trade_role", "source_url": "https://www.facebook.com/p/George-Doll-100004180601778/"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
116	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	Gus Doll	Third-Generation Family Member	heir	3	t	f	\N	https://linkedin.com/in/gus-doll-24497613b	\N	\N	\N	\N	\N	\N	Third-generation Doll family member active in the business.	["Named as 3rd generation in company history page"]	\N	[{"year": 2018, "degree": "Bachelor's (Class of 2018)", "school": "United States Military Academy at West Point", "source_url": "https://x.com/Stalbertsprtfan/status/1001180853714800641"}]	Gus Doll is a third-generation member of the Doll family and co-owner/partner at Doll Distributing in Des Moines, Iowa. A 2018 graduate of the United States Military Academy at West Point, he served as an Army officer including roles as a Platoon Leader with the 173rd Airborne Brigade Combat Team in Germany and as a Platoon Leader and Executive Officer in the 75th Ranger Regiment before joining Doll Distributing as a Sales Representative in September 2023. He is known in the industry as an Army Ranger turned distributor helping carry the family business forward.	[]	[{"fact": "Co-owner/partner at Doll Distributing, third-generation family member working alongside Andrew, Lauren, George, and Charles.", "type": "trade_role", "source_url": "https://www.mydigitalpublication.com/article/A+Third+Generation+Family+Business/4863971/832638/article.html"}, {"fact": "VP of External Affairs on the board of Folds of Honor Iowa, a nonprofit providing education scholarships to families of fallen and disabled service members and first responders.", "type": "board_position", "source_url": "https://www.facebook.com/foldsofhonoriowa/posts/we-have-a-board-consisting-of-very-dedicated-individuals-who-are-committed-to-th/122110789406385128/"}, {"fact": "U.S. Army Ranger; served as Platoon Leader and Executive Officer in the 75th Ranger Regiment (2020-2023) after serving as Platoon Leader with the 173rd Airborne Brigade Combat Team in Grafenwöhr, Germany (2018-2020).", "type": "award", "source_url": "https://www.linkedin.com/in/gus-doll-24497613b"}, {"fact": "Avid waterfowl hunter; collaborated with MOJO Outdoors as an Iowa native and U.S. Army Soldier on early goose hunting in the South Dakota flyway.", "type": "hobby", "source_url": "https://www.facebook.com/MOJOOutdoorsTV/posts/gus-doll-iowa-native-and-us-army-soldier-helped-the-mojo-team-create-a-no-fly-zo/10157999090387595/"}, {"fact": "Folds of Honor Iowa described Gus Doll as 'West Point Graduate, Army Ranger, and co-owner of Doll Distributing.'", "type": "quote", "source_url": "https://www.facebook.com/foldsofhonoriowa/posts/we-have-a-board-consisting-of-very-dedicated-individuals-who-are-committed-to-th/122110789406385128/"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
110	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	Mark Doll	Chief Executive Officer	ceo	2	t	f	\N	\N	\N	(515) 263-3208	107	\N	Merlin G. Doll	Julia Doll	CEO of Doll Distributing and member of the second generation that bought the business in 1987. Currently leading the succession transition to the third generation, which includes his daughter Lauren Doll-Sheeder.	["CEO per The Org", "Featured with daughter Lauren Doll-Sheeder on Iowa Public Radio discussing family-business succession", "Part of the 1987 second-generation buyout"]	\N	[]	Mark Doll is the CEO and an owner of Doll Distributing, a beer/beverage distributor founded by his parents Merlin and Edith Doll in 1965. He was part of the second generation (with siblings Jeff, Tami, Scott, and Jay) that took over the Iowa-based business in 1987 and grew it into a multi-state operation now serving Iowa, Minnesota, South Dakota, and North Dakota. He is currently leading the succession transition to the third generation, which includes his daughter Lauren Doll-Sheeder. He was named the Iowa Restaurant Association's 2014 Purveyor Partner of the Year.	["https://www.iowapublicradio.org/podcast/river-to-river/2023-11-14/the-struggles-and-successes-of-keeping-a-business-in-the-family", "https://www.businessrecord.com/doll-distributing-a-legacy-of-success-in-the-heart-of-iowa/", "https://www.mydigitalpublication.com/article/A+Third+Generation+Family+Business/4863971/832638/article.html", "https://www.youtube.com/watch?v=SI5s7NsCZ8g"]	[{"fact": "Named 2014 Purveyor Partner of the Year by the Iowa Restaurant Association.", "type": "award", "source_url": "https://www.youtube.com/watch?v=SI5s7NsCZ8g"}, {"fact": "Featured speaker on the NBWA BREW Leadership Forum panel on multigenerational family beer distribution businesses, identified as Owner/Partner of Doll Distributing.", "type": "trade_role", "source_url": "https://www.linkedin.com/posts/national-beer-wholesalers-association_how-are-top-beer-distributors-navigating-activity-7448422186190749696-QTuW"}, {"fact": "Featured with daughter Lauren Doll-Sheeder on Iowa Public Radio's River to River discussing the second-to-third-generation succession of Doll Distributing.", "type": "quote", "source_url": "https://www.iowapublicradio.org/podcast/river-to-river/2023-11-14/the-struggles-and-successes-of-keeping-a-business-in-the-family"}, {"fact": "Second-generation owner who oversaw expansion of Doll Distributing into 44 Iowa counties, 8 Minnesota counties, South Dakota (2025), and North Dakota (2026).", "type": "board_position", "source_url": "https://www.dolldistributing.com/about"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
118	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	David Zimmerman	Chief Information Officer	other	\N	t	f	\N	https://www.linkedin.com/in/david-zimmerman-3a02bb34	\N	\N	\N	\N	\N	\N	Chief Information Officer at Doll Distributing.	["Listed as CIO in Datanyze company profile"]	https://d2gjqh9j26unp0.cloudfront.net/profilepic/36a0965f7bab32623a3e3e7592820f99	[{"year": 2008, "degree": null, "school": "University of North Carolina at Greensboro", "source_url": "https://www.linkedin.com/in/david-zimmerman-3a02bb34"}]	David Zimmerman is the Chief Information Officer at Doll Distributing, LLC in the Des Moines metro area, bringing more than 20 years of experience developing and optimizing enterprise IT solutions for business operations and regulatory compliance. Earlier in his career he held leadership roles including Manager of Enterprise Distributed Systems at B/E Aerospace and a Chief Technology Officer of Storage role at AIG, where he managed multimillion-dollar technology budgets. He is known for aligning technology strategy with business goals and mentoring cross-functional teams. He also holds Apple Certified iOS Technician and Microsoft MCP/MCSA/MCSE certifications.	[]	[{"fact": "Chief Information Officer at Doll Distributing, LLC, based in the Des Moines Metropolitan Area.", "type": "trade_role", "source_url": "https://theorg.com/org/doll-distributing-llc/org-chart/david-zimmerman"}, {"fact": "Holds Apple Certified iOS Technician credential and Microsoft MCP, MCSA, and MCSE certifications for Server 2000.", "type": "award", "source_url": "https://www.linkedin.com/in/david-zimmerman-3a02bb34"}, {"fact": "Previously served as Manager of Enterprise Distributed Systems at B/E Aerospace and in a Chief Technology Officer of Storage role at AIG.", "type": "trade_role", "source_url": "https://theorg.com/org/doll-distributing-llc/org-chart/david-zimmerman"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
119	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	Elizabeth Linn	Director of Human Resources	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Director of Human Resources at Doll Distributing.	["Director, HR per Datanyze"]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
120	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	Jeremy Frank	Director of Sales Analytics	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Director of Sales Analytics at Doll Distributing.	["Director, Sales Analytics per Datanyze"]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
121	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	Julie Drake	Director of Human Resources	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Director of Human Resources at Doll Distributing.	["Director, HR per Datanyze"]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
122	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	Kelle Molloy	Director of Marketing	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Director of Marketing at Doll Distributing (also listed as Kelle Swanson — likely same person, prior name).	["Director, Marketing per Datanyze"]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
108	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	Jay Doll	Owner (2nd Generation)	owner	2	t	f	\N	\N	\N	\N	107	\N	Merlin G. Doll	Laura Doll	Member of the second generation that purchased Doll Distributing from founders Merlin and Edith Doll in 1987.	["Part of 1987 second-generation buyout", "Listed in founder's obituary as son"]	\N	[]	Jay Doll is a second-generation owner of Doll Distributing, the Anheuser-Busch beverage distributor founded in 1965 by his parents Merlin and Edith Doll. Jay, alongside siblings Jeff, Mark, Tami, and Scott, took over the family business in 1987 and has helped grow the company from its original three-county Council Bluffs, Iowa territory into a multi-state distributor now operating across 44 Iowa counties, 8 Minnesota counties, South Dakota, and North Dakota. The third generation (Andrew, Lauren, George, Gus, and Charles) has since joined the company, with Jay and his siblings transitioning leadership.	["https://www.dolldistributing.com/about/the-doll-team", "https://www.mydigitalpublication.com/article/A+Third+Generation+Family+Business/4863971/832638/article.html", "https://www.businessrecord.com/doll-distributing-a-legacy-of-success-in-the-heart-of-iowa/", "https://www.iowapublicradio.org/podcast/river-to-river/2023-11-14/the-struggles-and-successes-of-keeping-a-business-in-the-family"]	[{"fact": "Member of the second generation that took over Doll Distributing from founders Merlin and Edith Doll in 1987, alongside siblings Jeff, Mark, Tami, and Scott.", "type": "trade_role", "source_url": "https://www.mydigitalpublication.com/article/A+Third+Generation+Family+Business/4863971/832638/article.html"}, {"fact": "Co-owner of Doll Distributing, an Anheuser-Busch wholesaler headquartered at 1901 DeWolf Street, Des Moines, IA, serving Iowa, Minnesota, South Dakota and North Dakota.", "type": "trade_role", "source_url": "https://www.dolldistributing.com/about/the-doll-team"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
109	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	Jeff Doll	Owner (2nd Generation)	owner	2	t	f	\N	\N	\N	\N	107	\N	Merlin G. Doll	Mary Jane Doll	Member of the second generation that purchased Doll Distributing from founders Merlin and Edith Doll in 1987.	["Part of 1987 second-generation buyout", "Listed in founder's obituary as son"]	\N	[]	Jeff Doll is a member of the second generation of the Doll family that purchased Doll Distributing from founders Merlin and Edith Doll in 1987, alongside siblings Mark, Tami, Scott, and Jay. Under their leadership, the Iowa-based Anheuser-Busch wholesaler expanded from 3 counties to a multi-state operation covering Iowa, Minnesota, South Dakota, and North Dakota through six territorial acquisitions. He is no longer listed among the second-generation owners on the company's current team page (which now names only Mark, Tami, Jay, and Scott), suggesting he has stepped back as the business transitions to the third generation.	["https://www.mydigitalpublication.com/article/A+Third+Generation+Family+Business/4863971/832638/article.html", "https://www.dolldistributing.com/about", "https://www.dolldistributing.com/about/the-doll-team", "https://www.businessrecord.com/doll-distributing-a-legacy-of-success-in-the-heart-of-iowa/", "https://www.linkedin.com/company/doll-distributing-llc"]	[{"fact": "Part of the second-generation ownership group (Jeff, Mark, Tami, Scott and Jay) that took over Doll Distributing in 1987 and led territorial expansion across Iowa and into Minnesota.", "type": "trade_role", "source_url": "https://www.mydigitalpublication.com/article/A+Third+Generation+Family+Business/4863971/832638/article.html"}, {"fact": "Father of the late Alex Nelson Doll (age 21, d. Sept 12, 2013, Ames, Iowa); spouse listed as Mary Jane (MJ) Doll.", "type": "quote", "source_url": "https://www.cutleroneill.com/obituaries/Alex-Nelson-Doll?obId=120559"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
123	527c6236-4192-4b05-8715-3d11a0942b6d	Freida G. Maisel	Founder	founder	1	f	t	\N	\N	\N	\N	\N	\N	\N	\N	Former middle school English teacher who in 1973 purchased a struggling Mobile beer distributorship (formerly Jax Distributing) and built it into Gulf Distributing. Passed away in 2023.	["Founded Gulf Distributing Company in Mobile, AL in December 1973", "Brought Coors beer across the Mississippi River to Mobile in 1984", "Mother of CEO Elliot Maisel", "Passed away in early 2023 at age 94"]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
117	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	Lauren Doll-Sheeder	Owner / Sales & Marketing Specialist	owner	3	t	f	\N	https://www.linkedin.com/in/lauren-doll-sheeder-3b977052	\N	\N	110	\N	Mark Doll	\N	Third-generation owner of Doll Distributing. Daughter of CEO Mark Doll. Has held HR Coordinator, Office Administrator and Sales & Marketing Specialist roles at the company since 2014. Recognized with an Outstanding Anti-Human-Trafficking award by the Iowa Secretary of State.	["Self-described 'Proud Third Generation Owner of Doll Distributing'", "Daughter of Mark Doll (per IPR feature)", "Iowa State University, BS Marketing & Management 2008-2012", "Recognized by Iowa Secretary of State Paul Pate for anti-human-trafficking work"]	https://dg6qn11ynnp6a.cloudfront.net/speakerimages/316574358.bblwinter24-lauren-doll-sheeder.thumb.jpg	[{"year": 2012, "degree": "Bachelor of Science (B.S.), Marketing and Management", "school": "Iowa State University", "source_url": "https://www.linkedin.com/in/lauren-doll-sheeder-3b977052"}]	Lauren Doll-Sheeder is a third-generation owner and Managing Partner of Doll Distributing, the family-owned Iowa beverage distributor founded by her grandparents Merlin and Edith Doll in 1965. She joined the company in June 2014 as a Metro On-Premise Relief Account Manager, then progressed through HR Coordinator (2015–2016), Office Administrator (2016–2017), and Sales & Marketing Specialist (2017–2022) before stepping into ownership and managing-partner roles alongside her father Mark Doll. She is recognized in the industry as a young family-business leader carrying on Doll's legacy across Iowa, Minnesota and now the Dakotas, and serves on the NBWA BREW (Beer Retail Excellence for Women) Advisory Board.	["https://www.iowapublicradio.org/podcast/river-to-river/2023-11-14/the-struggles-and-successes-of-keeping-a-business-in-the-family", "https://www.businessrecord.com/doll-distributing-a-legacy-of-success-in-the-heart-of-iowa/", "https://www.instagram.com/p/DCXORvKRvD4/", "https://sos.iowa.gov/news-resources/creating-wave-change-human-trafficking-awareness-month", "https://iowanaht.org/about-us/network-awards/"]	[{"fact": "Recipient of the 2025 Outstanding Anti-Trafficking Service Award from the Iowa Network Against Human Trafficking and Slavery, presented by Iowa Secretary of State Paul Pate for her leadership of Doll Distributing's work with Iowa Businesses Against Trafficking (IBAT).", "type": "award", "source_url": "https://www.facebook.com/IASecretaryofState/posts/we-were-honored-to-present-the-outstanding-anti-trafficking-service-award-given-/1289270083018567/"}, {"fact": "Advisory Board Member, NBWA BREW (Beer Retail Excellence for Women).", "type": "board_position", "source_url": "https://www.instagram.com/p/DCXORvKRvD4/"}, {"fact": "Managing Partner / third-generation owner of Doll Distributing, transitioning leadership from her father, CEO Mark Doll.", "type": "trade_role", "source_url": "https://www.iowapublicradio.org/podcast/river-to-river/2023-11-14/the-struggles-and-successes-of-keeping-a-business-in-the-family"}, {"fact": "Co-authored a guest editorial with Iowa Secretary of State Paul Pate titled 'Create a wave of change to stop human trafficking,' urging Iowa businesses to join IBAT.", "type": "quote", "source_url": "https://www.thegazette.com/guest-columnists/create-a-wave-of-change-to-stop-human-trafficking/"}, {"fact": "Featured panelist at Brewbound Live Winter 2024 representing Doll Distributing.", "type": "board_position", "source_url": "https://www.brewbound.com/events/brewboundlivewinter24"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
128	527c6236-4192-4b05-8715-3d11a0942b6d	Beth Sayler	Managing Director, Human Resources	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Managing Director of Human Resources at Gulf Distributing Holdings.	["Leads HR function"]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
129	527c6236-4192-4b05-8715-3d11a0942b6d	Billy Clark	Manager of Strategic Operations	other	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Manager of Strategic Operations at Gulf Distributing Holdings.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
130	527c6236-4192-4b05-8715-3d11a0942b6d	Cam Koorangi	Director of Enterprise Solutions	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Director of Enterprise Solutions at Gulf Distributing Holdings.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
131	527c6236-4192-4b05-8715-3d11a0942b6d	Chandler Marston	Manager of Strategic Operations	other	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Manager of Strategic Operations at Gulf Distributing Holdings.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
132	527c6236-4192-4b05-8715-3d11a0942b6d	Chelsea Legg	Media Contact	other	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Media contact for Gulf Distributing Holdings.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
133	527c6236-4192-4b05-8715-3d11a0942b6d	David Gaines	Managing Director, Craft Beer	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Managing Director leading the Craft Beer portfolio at Gulf.	["Leads craft beer division"]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
126	527c6236-4192-4b05-8715-3d11a0942b6d	Louis E. Maisel	Chief Operating Officer	coo	3	t	f	\N	https://www.linkedin.com/in/louis-maisel-836bba35	\N	\N	124	\N	Elliot B. Maisel	\N	Chief Operating Officer of Gulf Distributing Holdings. Started his career in beer distribution in Austin, TX before returning to Mobile to join the family business; co-founded MOBTown Merch with siblings.	["COO of Gulf Distributing Holdings, LLC", "Worked ~5.5 years at a beer wholesaler in Austin, TX before joining Gulf", "Co-founder of MOBTown Merch", "Third-generation Maisel"]	https://thebusinessview.com/wp-content/uploads/2024/08/LOUIS-MAISEL.jpg	[{"year": 2010, "degree": null, "school": "Tulane University - A.B. Freeman School of Business", "source_url": "https://www.linkedin.com/in/louis-maisel-836bba35"}]	Louis Maisel began his career as a driver helper at Gulf Distributing Co. of Mobile before spending roughly five and a half years in Austin, Texas, where he worked at KEG 1 Central Texas as a team lead, brand manager and Red Bull brand manager, and later as a business analyst at Capitol Wright Distributing. He returned to the family business in October 2015 as Vice President of Gulf Distributing Holdings, and was elevated to Chief Operating Officer in January 2024. He co-founded MOBTown Merch with his siblings in 2016 (sold in 2024) and is known in Mobile for civic involvement, including founding the MOBOIL fundraiser for the National MS Society.	["https://www.mobileal.com/podcast/louis-maisel-gulf-distributing-mobtown-merch", "https://thebusinessview.com/executive-profile-louis-maisel/", "https://www.brewbound.com/pr/2026/03/06/gulf-distributing-holdings-selects-ohanafy-to-lead-enterprise-technology-transformation", "https://thebusinessview.com/gulf-distributing-companys-50-year-legacy-elliot-maisel-takes-a-look-back-and-ahead/"]	[{"fact": "Board of Trustees, National MS Society – AL-LA-MS Chapter", "type": "board_position", "source_url": "https://thebusinessview.com/executive-profile-louis-maisel/"}, {"fact": "Regions Bank Local Advisory Board member", "type": "board_position", "source_url": "https://thebusinessview.com/executive-profile-louis-maisel/"}, {"fact": "Board member, Downtown Mobile Alliance", "type": "board_position", "source_url": "https://thebusinessview.com/executive-profile-louis-maisel/"}, {"fact": "Founder of MOBOIL, an annual fundraising event for the MS Society", "type": "trade_role", "source_url": "https://thebusinessview.com/executive-profile-louis-maisel/"}, {"fact": "Co-founded MOBTown Merch with his siblings in 2016; sold the business in 2024", "type": "trade_role", "source_url": "https://thebusinessview.com/executive-profile-louis-maisel/"}, {"fact": "On Gulf's tech transformation: 'as we enter a new generation of leadership, that mindset is more important than ever' — announcing partnership with Ohanafy", "type": "quote", "source_url": "https://www.brewbound.com/pr/2026/03/06/gulf-distributing-holdings-selects-ohanafy-to-lead-enterprise-technology-transformation"}, {"fact": "Aspires to be a 'good' golfer; favorite restaurant is Dreamland; favorite holiday is Thanksgiving; favorite show Peaky Blinders", "type": "hobby", "source_url": "https://thebusinessview.com/executive-profile-louis-maisel/"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
138	527c6236-4192-4b05-8715-3d11a0942b6d	James R. Cox	Chief Financial Officer	cfo	\N	t	f	\N	https://linkedin.com/in/james-cox-6864b094	\N	\N	\N	\N	\N	\N	Chief Financial Officer at Gulf Distributing Holdings.	["CFO of Gulf Distributing Holdings"]	https://gulfdistributing.com/gulfdistributingofmobile/wp-content/uploads/sites/4/2023/11/Jay-Cox-Chief-Financial-Officer.jpg	[{"year": null, "degree": "Bachelor's in Accounting", "school": "Auburn University", "source_url": "https://allianceinterstaterisk.org/uploads/files/AIR_Jay_Cox_Bio_(2025).pdf"}, {"year": null, "degree": "Master's in Accounting", "school": "Auburn University", "source_url": "https://allianceinterstaterisk.org/uploads/files/AIR_Jay_Cox_Bio_(2025).pdf"}]	James 'Jay' R. Cox, CPA, is Chief Financial Officer of Gulf Distributing Holdings, LLC, where he has worked since 2009 after selling his partnership interest in the Mobile public-accounting firm Dudley, Chateau & Cox. He began his career at Dudley, Ruland & Chateau immediately after graduating from Auburn University with bachelor's and master's degrees in accounting, and rose to partner before joining GDH. At Gulf Distributing he oversees finance and the company's insurance program and has been involved in numerous mergers and acquisitions across the wholesaler's seven-warehouse, 1,200-employee operation spanning Alabama, parts of Mississippi and the Florida panhandle. A Mobile native, he serves on several boards including the Finance Council for Corpus Christi Parish.	["https://www.brewbound.com/pr/2026/03/06/gulf-distributing-holdings-selects-ohanafy-to-lead-enterprise-technology-transformation", "https://mobilechamber.com/2023/01/gulf-distributing-to-relocate-operations-to-downtown-mobile/", "https://baybusinessnews.com/articles/elliot-maisel-chairman-ceo-gulf-distributing/"]	[{"fact": "Oversees Gulf Distributing's insurance program and has led numerous M&A transactions during his career.", "type": "trade_role", "source_url": "https://allianceinterstaterisk.org/uploads/files/AIR_Jay_Cox_Bio_(2025).pdf"}, {"fact": "Sits on the Finance Council for Corpus Christi Parish in Mobile, AL.", "type": "board_position", "source_url": "https://allianceinterstaterisk.org/uploads/files/AIR_Jay_Cox_Bio_(2025).pdf"}, {"fact": "Enjoys golf, hunting, and fishing; married 35 years to wife Nicky (also an Auburn grad), with three daughters.", "type": "hobby", "source_url": "https://allianceinterstaterisk.org/uploads/files/AIR_Jay_Cox_Bio_(2025).pdf"}, {"fact": "Former partner at Mobile public accounting firm Dudley, Chateau & Cox before joining GDH in 2009.", "type": "trade_role", "source_url": "https://allianceinterstaterisk.org/uploads/files/AIR_Jay_Cox_Bio_(2025).pdf"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
139	527c6236-4192-4b05-8715-3d11a0942b6d	James T. Marston	Chief Commercial Officer	other	\N	t	f	\N	https://www.linkedin.com/in/jimmy-marston-b0288717	\N	\N	\N	\N	\N	\N	Chief Commercial Officer at Gulf Distributing Holdings.	["CCO of Gulf Distributing Holdings"]	https://gulfdistributing.com/gulfdistributingofmobile/wp-content/uploads/sites/4/2023/08/James-Marston-Chief-Operating-Officer.jpg	[]	Jimmy (James T.) Marston joined Gulf Distributing Holdings in June 1984 and has spent more than four decades with the Mobile, Alabama-based wholesaler, rising through Vice President of Sales and Operations to become Chief Commercial Officer. As part of a 2024 corporate restructuring he was named the company's first non-family member of the leadership board, and now oversees Gulf's sales and marketing organization across its Alabama, Florida and Mississippi territories, with responsibility for expanding the brand portfolio and strengthening supplier relationships.	["https://businessalabama.com/jimmy-marston-four-decades-of-leadership-and-dedication-at-gulf-distributing/", "https://businessalabama.com/gulf-distributing-adding-60-jobs-over-next-year/", "https://www.lagniappemobile.com/news/gulf-distributing-expanding-operations-changing-leadership/article_9fca8250-b0c7-11ee-8257-b7de6ec0954b.html", "https://thebusinessview.com/gulf-distributing-companys-50-year-legacy-elliot-maisel-takes-a-look-back-and-ahead/"]	[{"fact": "Named Gulf Distributing's first non-family member of the leadership/board, leading sales and marketing company-wide as Chief Commercial Officer.", "type": "trade_role", "source_url": "https://www.lagniappemobile.com/news/gulf-distributing-expanding-operations-changing-leadership/article_9fca8250-b0c7-11ee-8257-b7de6ec0954b.html"}, {"fact": "Has been with Gulf Distributing Holdings since June 1984, serving as Vice President of Sales and Operations across Florida, Alabama and Mississippi before being elevated to Chief Commercial Officer.", "type": "trade_role", "source_url": "https://www.linkedin.com/in/jimmy-marston-b0288717"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
140	527c6236-4192-4b05-8715-3d11a0942b6d	Jana Price	Organizational Development and Coaching Manager	other	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Organizational Development and Coaching Manager at Gulf Distributing Holdings.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
141	527c6236-4192-4b05-8715-3d11a0942b6d	Jeff Fahmi	Director of Technology	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Director of Technology at Gulf Distributing Holdings.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
142	527c6236-4192-4b05-8715-3d11a0942b6d	Jeff Floyd	Senior Vice President - North Division	vp_sales	\N	t	f	\N	https://www.linkedin.com/in/jeff-floyd-b5b15044	\N	\N	\N	\N	\N	\N	Senior Vice President leading Gulf's North Division.	["SVP – North Division"]	https://gulfdistributing.com/wp-content/uploads/2023/12/Jeff-Floyd.jpg	[]	Jeff Floyd joined Gulf Distributing Holdings in 2009 and was promoted in late 2025 to Senior Vice President of the North Division, capping more than 35 years in the beverage distribution industry. He has held several key leadership roles at Gulf, including General Sales Manager, Director of Business Insights, and Managing Director of Chains, where he strengthened retailer partnerships and built high-performing teams. His leadership has contributed to consecutive MolsonCoors President's Awards, the Heineken Red Star Award, and Preferred Vendor Status with Wal-Mart. Based in Birmingham, AL, he is known across the industry for his chains and national-account expertise.	[]	[{"fact": "Appointed to the Alabama Grocers Association Board of Directors in 2025.", "type": "board_position", "source_url": "https://www.linkedin.com/posts/gulf-distributing-holdings-llc_we-are-proud-to-announce-the-promotion-of-activity-7404553672778555392-mdDn"}, {"fact": "Leadership contributed to Gulf earning consecutive MolsonCoors President's Awards and the Heineken Red Star Award.", "type": "award", "source_url": "https://www.linkedin.com/posts/gulf-distributing-holdings-llc_we-are-proud-to-announce-the-promotion-of-activity-7404553672778555392-mdDn"}, {"fact": "Promoted to Senior Vice President - North Division in late 2025; previously Managing Director of Chains, Director of Business Insights, and General Sales Manager at Gulf Distributing.", "type": "trade_role", "source_url": "https://www.linkedin.com/posts/gulf-distributing-holdings-llc_we-are-proud-to-announce-the-promotion-of-activity-7404553672778555392-mdDn"}, {"fact": "Joined Gulf Distributing Holdings in 2009 with 35 years of total beverage industry experience; based in Birmingham, AL.", "type": "trade_role", "source_url": "https://www.linkedin.com/in/jeff-floyd-b5b15044"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
143	527c6236-4192-4b05-8715-3d11a0942b6d	Jimmy Sewell	Managing Director of Chain Accounts	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Managing Director of Chain Accounts at Gulf Distributing Holdings.	["Leads chain accounts"]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
144	527c6236-4192-4b05-8715-3d11a0942b6d	Joey Irelan	Vice President - Red Bull	vp_sales	\N	t	f	\N	https://www.linkedin.com/in/joey-irelan-05908165	\N	(850) 796-2479	\N	\N	\N	\N	Vice President overseeing the Red Bull portfolio at Gulf.	["VP – Red Bull"]	https://gulfdistributing.com/wp-content/uploads/2023/07/Joey-Irelan.jpg	[]	Joey Irelan joined Gulf Distributing Holdings in February 2005 and has progressed through Sales/Area Manager, North America Manager, and General Manager roles to his current position as Vice President - Red Bull, overseeing the company's Red Bull energy drink portfolio across its Floribama footprint. Before Gulf, he spent six years as a Merchandiser/Salesperson/Territory Manager at Buffalo Rock Pepsi in the Pensacola/Fort Walton Beach market and briefly served as a Support Manager at Wal-Mart. He is listed as a contact for Goldring Gulf Distributing through the Fort Walton Beach Chamber of Commerce, reflecting his long-running role in the Florida Panhandle energy-drink business.	[]	[{"fact": "Listed as a Goldring Gulf Distributing contact via the Fort Walton Beach Chamber of Commerce member directory.", "type": "trade_role", "source_url": "https://www.fwbchamber.org/list/member/goldring-gulf-distributing-1890"}, {"fact": "Prior to Gulf, worked at Buffalo Rock Pepsi (1997-2003) as Merchandiser/Salesperson/Territory Manager in the Pensacola/Fort Walton Beach territory.", "type": "trade_role", "source_url": "https://www.linkedin.com/in/joey-irelan-05908165"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
145	527c6236-4192-4b05-8715-3d11a0942b6d	John Racciatti	Gulf Ambassador	other	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Gulf Ambassador at Gulf Distributing Holdings.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
146	527c6236-4192-4b05-8715-3d11a0942b6d	Josh Smith	Director of Strategic Operations	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Director of Strategic Operations at Gulf Distributing Holdings.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
147	527c6236-4192-4b05-8715-3d11a0942b6d	Jules Dickinson	Media Contact	other	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Media contact for Gulf Distributing Holdings.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
148	527c6236-4192-4b05-8715-3d11a0942b6d	Olivia Wrisley	Director of Marketing	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Director of Marketing at Gulf Distributing Holdings.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
149	527c6236-4192-4b05-8715-3d11a0942b6d	Pete Teske	Director of Supply Chain Management	director	\N	f	f	\N	\N	\N	\N	\N	\N	\N	\N	Director of Supply Chain Management at Gulf Distributing Holdings.	[]	\N	[]	\N	[]	[]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
124	527c6236-4192-4b05-8715-3d11a0942b6d	Elliot B. Maisel	Chairman & CEO	ceo	2	t	f	\N	https://www.linkedin.com/in/elliot-maisel-92b538a	\N	\N	123	\N	Freida G. Maisel	\N	Son of founder Freida Maisel; joined Gulf Distributing in 1974 and took the reins in the early 1990s. Named Business Alabama's CEO of the Year. University of Alabama graduate.	["Chairman and CEO of Gulf Distributing Holdings, LLC", "Began working at Gulf Distributing in 1974", "Took over leadership of the company in the early 1990s", "Also affiliated with Herman Maisel & Company", "Chairman Emeritus, Mobile Airport Authority"]	https://thebusinessview.com/wp-content/uploads/2024/05/elliot-maisell.jpg	[{"year": null, "degree": "Real Estate", "school": "University of Alabama", "source_url": "https://radaris.com/p/Elliot/Maisel/"}]	Elliot B. Maisel began his career in 1974 working at his mother Freida Maisel's beverage distribution company (Gulf Distributing) and his father's real estate firm, Herman Maisel and Company. After operating Hamrick Motor Company auto dealerships in the 1980s and pari-mutuel racing development projects, he sold those interests in 1990 and officially took the reins at Gulf Distributing in the early 1990s, growing the company through brand and territory acquisition. Today he serves as Chairman & CEO of Gulf Distributing Holdings, LLC, which employs approximately 1,300 people across Alabama, Florida and Mississippi and represents more than 120 beverage suppliers including Molson Coors, Constellation, Heineken, and Mark Anthony Brands. He was named Business Alabama's 2023 CEO of the Year and a 2023 MolsonCoors Legend.	["https://baybusinessnews.com/articles/elliot-maisel-chairman-ceo-gulf-distributing/", "https://thebusinessview.com/gulf-distributing-companys-50-year-legacy-elliot-maisel-takes-a-look-back-and-ahead/", "https://www.al.com/news/2025/01/thc-infused-beverages-mobile-mayoral-race-qa-with-beer-distributor-elliot-maisel.html", "https://www.southalabama.edu/departments/publicrelations/pressreleases/030926daa.html", "https://mobilechamber.com/2023/01/gulf-distributing-to-relocate-operations-to-downtown-mobile/"]	[{"fact": "Named Business Alabama's 2023 CEO of the Year", "type": "award", "source_url": "https://thebusinessview.com/gulf-distributing-companys-50-year-legacy-elliot-maisel-takes-a-look-back-and-ahead/"}, {"fact": "Named a MolsonCoors Legend in 2023, the company's highest honor for distributor partners", "type": "award", "source_url": "https://www.southalabama.edu/departments/publicrelations/pressreleases/030926daa.html"}, {"fact": "Honored at the 21st Annual University of South Alabama Distinguished Alumni & Service Awards (March 2026)", "type": "award", "source_url": "https://www.southalabama.edu/departments/publicrelations/pressreleases/030926daa.html"}, {"fact": "Chairman emeritus of the Mobile Airport Authority; instrumental in moving Mobile's airport closer to downtown", "type": "board_position", "source_url": "https://www.southalabama.edu/departments/publicrelations/pressreleases/030926daa.html"}, {"fact": "Made a transformational gift in 2024 supporting a new education and research building for the University of South Alabama Whiddon College of Medicine", "type": "board_position", "source_url": "https://www.southalabama.edu/departments/publicrelations/pressreleases/030926daa.html"}, {"fact": "Chairman & CEO of Gulf Distributing Holdings, LLC; also Chairman and CEO of Fin Branding Group, LLC since June 2011", "type": "trade_role", "source_url": "https://radaris.com/p/Elliot/Maisel/"}, {"fact": "On taking the CEO of the Year award: 'It's certainly very easy to be CEO of a group of people like this. We truly work as a team. This award brings good pride to our company, our employees and the city.'", "type": "quote", "source_url": "https://thebusinessview.com/gulf-distributing-companys-50-year-legacy-elliot-maisel-takes-a-look-back-and-ahead/"}, {"fact": "On his mother Freida: 'She was a steel magnolia. She was strong. She was able to lead by example with grace and charm.'", "type": "quote", "source_url": "https://thebusinessview.com/gulf-distributing-companys-50-year-legacy-elliot-maisel-takes-a-look-back-and-ahead/"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
125	527c6236-4192-4b05-8715-3d11a0942b6d	Evan B. Maisel	Senior Vice President	vp_ops	3	t	f	\N	\N	\N	\N	124	\N	Elliot B. Maisel	\N	Senior Vice President at Gulf Distributing Holdings; son of CEO Elliot Maisel.	["Senior Vice President at Gulf Distributing Holdings", "Co-founder of MOBTown Merch with siblings", "Third-generation member of the Maisel family"]	https://gulfdistributing.com/wp-content/uploads/2025/07/Evan-Maisel-2.jpg	[]	Evan B. Maisel serves as Senior Vice President of Gulf Distributing Holdings, the family-owned beer and beverage distributor founded in 1973 by his grandmother Freida G. Maisel. As a third-generation Maisel, he works alongside his father, Chairman & CEO Elliot B. Maisel, and siblings Rebecca L. Maisel (Chief Corporate Strategy Officer) and Louis E. Maisel (Chief Operating Officer) in leading the Mobile, Alabama-headquartered company that operates six wholesaler subsidiaries across Alabama, the Florida panhandle, and Mississippi.	["https://baybusinessnews.com/articles/elliot-maisel-chairman-ceo-gulf-distributing/", "https://thebusinessview.com/gulf-distributing-companys-50-year-legacy-elliot-maisel-takes-a-look-back-and-ahead/", "https://www.brewbound.com/pr/2026/03/06/gulf-distributing-holdings-selects-ohanafy-to-lead-enterprise-technology-transformation", "https://mobilechamber.com/2023/01/gulf-distributing-to-relocate-operations-to-downtown-mobile/"]	[{"fact": "Listed as Senior Vice President on the Gulf Distributing Holdings leadership team alongside siblings Rebecca L. Maisel (Chief Corporate Strategy Officer) and Louis E. Maisel (Chief Operating Officer).", "type": "trade_role", "source_url": "https://gulfdistributing.com/team/"}, {"fact": "Named among Gulf Distributing leadership stakeholders (with Louis Maisel, Jimmy Marston, Jay Cox, and Cam Koorangi) in the Gulf x Ohanafy enterprise technology partnership announcement.", "type": "trade_role", "source_url": "https://www.linkedin.com/posts/ohanafy_gulf-x-ohanafy-partnership-announcement-activity-7435693047021211648-Yjxc"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
127	527c6236-4192-4b05-8715-3d11a0942b6d	Rebecca L. Maisel	Chief Corporate Strategy Officer	other	3	t	f	\N	https://www.linkedin.com/in/rmaisel	\N	\N	124	\N	Elliot B. Maisel	\N	Chief Corporate Strategy Officer at Gulf Distributing Holdings; daughter of CEO Elliot Maisel and a third-generation member of the Maisel family.	["Chief Corporate Strategy Officer", "Co-founded MOBTown Merch with siblings Evan and Louis", "Granddaughter of founder Freida G. Maisel"]	https://thebusinessview.com/wp-content/uploads/2024/10/Rebecca_Image_Resize-1-scaled.jpg	[{"year": 2007, "degree": "JD", "school": "American University, Washington College of Law", "source_url": "https://www.linkedin.com/in/rmaisel"}]	Rebecca L. Maisel is Chief Corporate Strategy Officer at Gulf Distributing Holdings, a third-generation family beer wholesaler based in Mobile, Alabama, founded by her grandmother Freida Maisel in 1973. An attorney by training, she joined Gulf about 16 years ago and previously served as Senior Vice President of Legal and Government Affairs, leading legal, government affairs, HR, and organizational development. In October 2024 she was elected Chair of the National Beer Wholesalers Association (NBWA) at its 87th Annual Convention, after previously chairing NBWA's Next Generation Group and the Alabama Wholesale Beer Association. She is known industry-wide for advocating a 'back to basics' approach for distributors and championing emerging leaders in the beer industry.	["https://www.brewbound.com/news/nbwa-board-chair-rebecca-maisel-lets-go-back-to-basics/", "https://thebusinessview.com/gulf-distributings-rebecca-maisel-named-chair-of-national-beer-wholesalers-association/", "https://beernet.com/bbd/bbd-article/were-never-done-chasing-rebecca-maisel-on-gulfs-playbook/", "https://nbwa.org/press-release/brewed-for-this-moment-brew-leadership-forum-delivers-star-power-and-timely-lessons/"]	[{"fact": "Elected 2024-2025 Chair of the Board of the National Beer Wholesalers Association (NBWA) on October 1, 2024 in San Diego.", "type": "trade_role", "source_url": "https://thebusinessview.com/gulf-distributings-rebecca-maisel-named-chair-of-national-beer-wholesalers-association/"}, {"fact": "Previously chaired NBWA's Next Generation Group and the Alabama Wholesale Beer Association; spent eight years on NBWA's Management Committee.", "type": "trade_role", "source_url": "https://www.brewbound.com/news/nbwa-board-chair-rebecca-maisel-lets-go-back-to-basics/"}, {"fact": "Serves on the advisory board of BREW (Building Relationships and Empowering Women), an NBWA initiative supporting inclusion in beer and beverage distribution.", "type": "board_position", "source_url": "https://www.brewbound.com/news/nbwa-board-chair-rebecca-maisel-lets-go-back-to-basics/"}, {"fact": "Active member of the Beer Industry of Florida.", "type": "trade_role", "source_url": "https://thebusinessview.com/gulf-distributings-rebecca-maisel-named-chair-of-national-beer-wholesalers-association/"}, {"fact": "'My grandmother, Freida Maisel, founded Gulf Distributing back in 1973, and I always knew I wanted to be a beer distributor and part of our family business.'", "type": "quote", "source_url": "https://thebusinessview.com/gulf-distributings-rebecca-maisel-named-chair-of-national-beer-wholesalers-association/"}]	new	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: red_flag; Type: TABLE DATA; Schema: research; Owner: evgenyarol
--

COPY research.red_flag (id, distributor_id, flag_type, severity, description, source_url, detected_at) FROM stdin;
8	be559c7b-c719-4812-a69c-a5ccbfb0ece0	other	medium	Eugene P. "Gene" Vukelic, Chairman of Try-It Distributing and Philanthropic Business Leader, Dies at 94. December 29, 1930 – August 3, 2025.	https://www.amigone.com/obituaries/Eugene-P-Gene-Vukelic?obId=43830417	2026-05-08 06:40:45.135465+02
9	be559c7b-c719-4812-a69c-a5ccbfb0ece0	other	medium	Saratoga Eagle back in operation following Christmas Day fire.	https://www.bizjournals.com/albany/news/2022/01/19/saratoga-eagle-up-and-running-after-fire.html	2026-05-08 06:40:45.135763+02
10	be559c7b-c719-4812-a69c-a5ccbfb0ece0	bankruptcy	medium	Adversary case 25-02203 Complaint by Thomas A. Pitta against Saratoga Eagle Sales & Service Inc.. Fee Amount $ 350.. (12 (Recovery of money/property - 547 preference)) filed by Plaintiff Thomas A. Pitta.	https://www.pacermonitor.com/public/case/60580793/Pitta_v_Saratoga_Eagle_Sales__Service_Inc	2026-05-08 06:40:45.136009+02
11	be559c7b-c719-4812-a69c-a5ccbfb0ece0	other	medium	Pre-Trial hearing to be held on 12/22/2025 at 11:00 AM at MBK - Courtroom 8, Trenton.	https://www.pacermonitor.com/public/case/60580793/Pitta_v_Saratoga_Eagle_Sales__Service_Inc	2026-05-08 06:40:45.136273+02
18	527c6236-4192-4b05-8715-3d11a0942b6d	lawsuit	medium	Plaintiff, Jawarren Hector, by and through counsel, brought this action against his former employer, Gulf Distributing Company of Mobile, LLC. Hector contended that Gulf Distributing violated the Fair Labor Standards Act, 29 U.S.C. §§ 201 et seq. ('FLSA'), by failing to pay him overtime compensation as required by the statute.	https://www.casemine.com/judgement/us/5b765f968b09d30aefc3c3ec	2026-05-08 21:44:12.264785+02
25	687fa905-ed54-4dcb-94a7-e782c839f030	other	low	Ownership / control: Empire is family-run by the Kahn brothers but is ultimately owned by McLane Company, a wholly owned Berkshire Hathaway subsidiary (parent Kahn Ventures acquired 2010). Strategic and capital decisions sit under a large parent.	https://rationalwalk.com/berkshires-mclane-subsidiary-acquires-kahn-ventures/	2026-06-05 02:51:01.021794+02
26	687fa905-ed54-4dcb-94a7-e782c839f030	other	medium	Supplier concentration: Loss of a single major supplier (Diageo, Bacardi, Pernod Ricard, etc.) can materially reshape a distributor's book — as Diageo's 2020 departure from the similarly named Empire Merchants of NY illustrated. Supplier-realignment risk applies to Empire Distributors' markets as well.	https://www.shankennewsdaily.com/2020/06/01/25817/exclusive-major-market-change-as-diageo-leaves-empire-for-southern-glazers-in-new-york/	2026-06-05 02:51:01.021794+02
27	687fa905-ed54-4dcb-94a7-e782c839f030	other	low	Name ambiguity: Multiple unrelated firms share the 'Empire' name (Empire Merchants NY, etc.). Care is needed to avoid attributing their news to the Kahn-family Empire Distributors of Atlanta. Official site is empiredist.com (not .org).	https://empiredist.com/	2026-06-05 02:51:01.021794+02
28	f9a78f4a-c9e8-439b-9d26-13a407aec584	lawsuit	medium	Market concentration / antitrust: The 2014-2015 absorption of rival Windmill/Phoenix gave Manhattan Beer roughly half of NYC's ~100M-case beer market, drawing scrutiny over pricing power; deal required supplier and DOJ review.	https://www.brewbound.com/news/nyc-beer-distributors-reach-tentative-merger-agreement/	2026-06-05 02:51:01.04972+02
29	f9a78f4a-c9e8-439b-9d26-13a407aec584	lawsuit	medium	Customer billing dispute: Manhattan Beer was accused in litigation of 'nickel and diming' customers for millions via disputed fees/charges.	https://westfaironline.com/courts/manhattan-beer-accused-of-nickel-and-diming-customers-for-millions-of-dollars/	2026-06-05 02:51:01.04972+02
30	f9a78f4a-c9e8-439b-9d26-13a407aec584	other	low	Data inconsistency: Third-party aggregators report widely varying revenue ($570M-$750M) and employee figures (804-1,850); company/primary-press figures (~1,850 employees, ~$640M revenue) are more reliable.	https://www.bevindustry.com/articles/89600-2016-wholesaler-of-the-year-manhattan-beer-distributors	2026-06-05 02:51:01.04972+02
\.


--
-- Data for Name: run; Type: TABLE DATA; Schema: research; Owner: evgenyarol
--

COPY research.run (id, distributor_id, url, status, current_phase, progress_pct, error, started_at, updated_at, completed_at, runtime_seconds, created_by, cost_usd, web_searches, web_search_cost_usd, llm_cost_usd, input_tokens, output_tokens) FROM stdin;
1	687fa905-ed54-4dcb-94a7-e782c839f030	https://empiredistributors.com	done	done	100	\N	2026-05-08 04:41:09.520243+02	2026-05-08 04:41:36.614483+02	2026-05-08 04:41:36.614483+02	4.522	admin	\N	\N	\N	\N	\N	\N
11	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	http://www.dolldistributing.com/	failed	failed	100	BadRequestError: Error code: 400 - {'error': "Error code: 424 - {'error': {'message': 'Overloaded', 'type': 'failed_dependency_error'}, 'message': 'Overloaded', 'status_code': 424}", 'code': 400}	2026-05-08 19:02:40.712953+02	2026-05-08 19:03:25.936279+02	2026-05-08 19:03:25.936279+02	\N	admin	\N	\N	\N	\N	\N	\N
2	687fa905-ed54-4dcb-94a7-e782c839f030	https://empiredistributors.com	done	done	100	\N	2026-05-08 04:41:55.731856+02	2026-05-08 04:42:02.893445+02	2026-05-08 04:42:02.893445+02	6.523	admin	\N	\N	\N	\N	\N	\N
6	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://saratogaeagle.com	done	done	100	\N	2026-05-08 06:06:52.371102+02	2026-05-08 06:18:58.006636+02	2026-05-08 06:18:58.006636+02	725.185	admin	\N	\N	\N	\N	\N	\N
3	f9a78f4a-c9e8-439b-9d26-13a407aec584	http://www.manhattanbeer.com/	done	done	100	\N	2026-05-08 04:54:59.32914+02	2026-05-08 04:55:05.142736+02	2026-05-08 04:55:05.142736+02	5.412	admin	\N	\N	\N	\N	\N	\N
7	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://saratogaeagle.com	done	done	100	\N	2026-05-08 06:22:22.949667+02	2026-05-08 06:40:45.1585+02	2026-05-08 06:40:45.1585+02	1100.872	admin	\N	\N	\N	\N	\N	\N
5	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://saratogaeagle.com	done	done	100	\N	2026-05-08 05:36:39.293627+02	2026-05-08 05:49:14.376846+02	2026-05-08 05:49:14.376846+02	753.322	admin	\N	\N	\N	\N	\N	\N
4	be559c7b-c719-4812-a69c-a5ccbfb0ece0	https://saratogaeagle.com	done	done	100	\N	2026-05-08 05:19:25.775876+02	2026-05-08 05:33:08.352847+02	2026-05-08 05:33:08.352847+02	821.798	admin	\N	\N	\N	\N	\N	\N
15	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	http://www.dolldistributing.com/	done	done	100	\N	2026-05-08 20:03:15.856905+02	2026-05-08 20:16:51.584012+02	2026-05-08 20:16:51.584012+02	815.63	admin	28.07	18	0.144	3.35	421892	49476
13	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	http://www.dolldistributing.com/	done	done	100	\N	2026-05-08 19:30:44.07169+02	2026-05-08 19:34:06.870471+02	2026-05-08 19:34:06.870471+02	202.509	admin	\N	\N	\N	\N	\N	\N
14	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	http://www.dolldistributing.com/	failed	failed	100	RuntimeError: discover returned 0 people — usually web_search quota exhausted or the company URL is unreachable. Try again later or fix the URL.	2026-05-08 19:41:47.307679+02	2026-05-08 19:42:06.604788+02	2026-05-08 19:42:06.604788+02	\N	admin	\N	\N	\N	\N	\N	\N
17	527c6236-4192-4b05-8715-3d11a0942b6d	https://gulfdistributing.com	failed	failed	100	RuntimeError: discover returned 0 people — usually web_search quota exhausted or the company URL is unreachable. Try again later or fix the URL.	2026-05-08 20:58:53.559462+02	2026-05-08 21:00:29.131962+02	2026-05-08 21:00:29.131962+02	\N	admin	\N	\N	\N	\N	\N	\N
16	527c6236-4192-4b05-8715-3d11a0942b6d	https://gulfdistributing.com	failed	failed	100	RuntimeError: discover returned 0 people — usually web_search quota exhausted or the company URL is unreachable. Try again later or fix the URL.	2026-05-08 20:31:35.395451+02	2026-05-08 20:33:34.308944+02	2026-05-08 20:33:34.308944+02	\N	admin	\N	\N	\N	\N	\N	\N
10	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	http://www.dolldistributing.com/	done	done	100	\N	2026-05-08 07:42:01.855332+02	2026-05-08 08:02:03.761368+02	2026-05-08 08:02:03.761368+02	1201.623	admin	\N	\N	\N	\N	\N	\N
9	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	http://www.dolldistributing.com/	failed	failed	100	AuthenticationError: Error code: 401 - {'error': "Error code: 401 - {'error': {'message': 'invalid legacy jwt', 'type': 'unauthorized_error'}, 'message': 'invalid legacy jwt', 'status_code': 401}", 'code': 401}	2026-05-08 07:08:08.10964+02	2026-05-08 07:36:29.576806+02	2026-05-08 07:36:29.576806+02	\N	admin	\N	\N	\N	\N	\N	\N
12	99fd34ba-42fc-4c5d-89d6-cbf3926e013f	http://www.dolldistributing.com/	done	done	100	\N	2026-05-08 19:14:29.201389+02	2026-05-08 19:18:11.473293+02	2026-05-08 19:18:11.473293+02	220.255	admin	\N	\N	\N	\N	\N	\N
18	527c6236-4192-4b05-8715-3d11a0942b6d	https://gulfdistributing.com	done	done	100	\N	2026-05-08 21:24:00.750566+02	2026-05-08 21:44:12.377815+02	2026-05-08 21:44:12.377815+02	1210.853	admin	9.38687	22	0.176	5.42646	694952	78068
\.


--
-- Name: material_id_seq; Type: SEQUENCE SET; Schema: distributor; Owner: evgenyarol
--

SELECT pg_catalog.setval('distributor.material_id_seq', 1, false);


--
-- Name: campaign_id_seq; Type: SEQUENCE SET; Schema: outreach; Owner: evgenyarol
--

SELECT pg_catalog.setval('outreach.campaign_id_seq', 1, false);


--
-- Name: campaign_lead_id_seq; Type: SEQUENCE SET; Schema: outreach; Owner: evgenyarol
--

SELECT pg_catalog.setval('outreach.campaign_lead_id_seq', 1, false);


--
-- Name: mailbox_id_seq; Type: SEQUENCE SET; Schema: outreach; Owner: evgenyarol
--

SELECT pg_catalog.setval('outreach.mailbox_id_seq', 1, false);


--
-- Name: webhook_log_id_seq; Type: SEQUENCE SET; Schema: outreach; Owner: evgenyarol
--

SELECT pg_catalog.setval('outreach.webhook_log_id_seq', 1, false);


--
-- Name: article_id_seq; Type: SEQUENCE SET; Schema: research; Owner: evgenyarol
--

SELECT pg_catalog.setval('research.article_id_seq', 213, true);


--
-- Name: email_event_id_seq; Type: SEQUENCE SET; Schema: research; Owner: evgenyarol
--

SELECT pg_catalog.setval('research.email_event_id_seq', 1, false);


--
-- Name: email_id_seq; Type: SEQUENCE SET; Schema: research; Owner: evgenyarol
--

SELECT pg_catalog.setval('research.email_id_seq', 28, true);


--
-- Name: email_thread_id_seq; Type: SEQUENCE SET; Schema: research; Owner: evgenyarol
--

SELECT pg_catalog.setval('research.email_thread_id_seq', 1, false);


--
-- Name: fact_id_seq; Type: SEQUENCE SET; Schema: research; Owner: evgenyarol
--

SELECT pg_catalog.setval('research.fact_id_seq', 378, true);


--
-- Name: person_id_seq; Type: SEQUENCE SET; Schema: research; Owner: evgenyarol
--

SELECT pg_catalog.setval('research.person_id_seq', 195, true);


--
-- Name: red_flag_id_seq; Type: SEQUENCE SET; Schema: research; Owner: evgenyarol
--

SELECT pg_catalog.setval('research.red_flag_id_seq', 30, true);


--
-- Name: run_id_seq; Type: SEQUENCE SET; Schema: research; Owner: evgenyarol
--

SELECT pg_catalog.setval('research.run_id_seq', 21, true);


--
-- Name: Branch Branch_pkey; Type: CONSTRAINT; Schema: distributor; Owner: evgenyarol
--

ALTER TABLE ONLY distributor."Branch"
    ADD CONSTRAINT "Branch_pkey" PRIMARY KEY (id);


--
-- Name: Contact Contact_pkey; Type: CONSTRAINT; Schema: distributor; Owner: evgenyarol
--

ALTER TABLE ONLY distributor."Contact"
    ADD CONSTRAINT "Contact_pkey" PRIMARY KEY (id);


--
-- Name: DistributorGroup DistributorGroup_pkey; Type: CONSTRAINT; Schema: distributor; Owner: evgenyarol
--

ALTER TABLE ONLY distributor."DistributorGroup"
    ADD CONSTRAINT "DistributorGroup_pkey" PRIMARY KEY (id);


--
-- Name: DistributorNote DistributorNote_pkey; Type: CONSTRAINT; Schema: distributor; Owner: evgenyarol
--

ALTER TABLE ONLY distributor."DistributorNote"
    ADD CONSTRAINT "DistributorNote_pkey" PRIMARY KEY (id);


--
-- Name: material material_pkey; Type: CONSTRAINT; Schema: distributor; Owner: evgenyarol
--

ALTER TABLE ONLY distributor.material
    ADD CONSTRAINT material_pkey PRIMARY KEY (id);


--
-- Name: campaign_lead campaign_lead_campaign_id_person_id_key; Type: CONSTRAINT; Schema: outreach; Owner: evgenyarol
--

ALTER TABLE ONLY outreach.campaign_lead
    ADD CONSTRAINT campaign_lead_campaign_id_person_id_key UNIQUE (campaign_id, person_id);


--
-- Name: campaign_lead campaign_lead_pkey; Type: CONSTRAINT; Schema: outreach; Owner: evgenyarol
--

ALTER TABLE ONLY outreach.campaign_lead
    ADD CONSTRAINT campaign_lead_pkey PRIMARY KEY (id);


--
-- Name: campaign campaign_pkey; Type: CONSTRAINT; Schema: outreach; Owner: evgenyarol
--

ALTER TABLE ONLY outreach.campaign
    ADD CONSTRAINT campaign_pkey PRIMARY KEY (id);


--
-- Name: mailbox mailbox_address_key; Type: CONSTRAINT; Schema: outreach; Owner: evgenyarol
--

ALTER TABLE ONLY outreach.mailbox
    ADD CONSTRAINT mailbox_address_key UNIQUE (address);


--
-- Name: mailbox mailbox_pkey; Type: CONSTRAINT; Schema: outreach; Owner: evgenyarol
--

ALTER TABLE ONLY outreach.mailbox
    ADD CONSTRAINT mailbox_pkey PRIMARY KEY (id);


--
-- Name: webhook_log webhook_log_pkey; Type: CONSTRAINT; Schema: outreach; Owner: evgenyarol
--

ALTER TABLE ONLY outreach.webhook_log
    ADD CONSTRAINT webhook_log_pkey PRIMARY KEY (id);


--
-- Name: article article_pkey; Type: CONSTRAINT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.article
    ADD CONSTRAINT article_pkey PRIMARY KEY (id);


--
-- Name: email_event email_event_pkey; Type: CONSTRAINT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.email_event
    ADD CONSTRAINT email_event_pkey PRIMARY KEY (id);


--
-- Name: email email_pkey; Type: CONSTRAINT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.email
    ADD CONSTRAINT email_pkey PRIMARY KEY (id);


--
-- Name: email_thread email_thread_pkey; Type: CONSTRAINT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.email_thread
    ADD CONSTRAINT email_thread_pkey PRIMARY KEY (id);


--
-- Name: fact fact_pkey; Type: CONSTRAINT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.fact
    ADD CONSTRAINT fact_pkey PRIMARY KEY (id);


--
-- Name: intel intel_pkey; Type: CONSTRAINT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.intel
    ADD CONSTRAINT intel_pkey PRIMARY KEY (distributor_id);


--
-- Name: person person_distributor_id_full_name_key; Type: CONSTRAINT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.person
    ADD CONSTRAINT person_distributor_id_full_name_key UNIQUE (distributor_id, full_name);


--
-- Name: person person_pkey; Type: CONSTRAINT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.person
    ADD CONSTRAINT person_pkey PRIMARY KEY (id);


--
-- Name: red_flag red_flag_pkey; Type: CONSTRAINT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.red_flag
    ADD CONSTRAINT red_flag_pkey PRIMARY KEY (id);


--
-- Name: run run_pkey; Type: CONSTRAINT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.run
    ADD CONSTRAINT run_pkey PRIMARY KEY (id);


--
-- Name: Branch_groupId_idx; Type: INDEX; Schema: distributor; Owner: evgenyarol
--

CREATE INDEX "Branch_groupId_idx" ON distributor."Branch" USING btree ("groupId");


--
-- Name: Contact_email_idx; Type: INDEX; Schema: distributor; Owner: evgenyarol
--

CREATE INDEX "Contact_email_idx" ON distributor."Contact" USING btree (lower(email)) WHERE (email IS NOT NULL);


--
-- Name: Contact_groupId_idx; Type: INDEX; Schema: distributor; Owner: evgenyarol
--

CREATE INDEX "Contact_groupId_idx" ON distributor."Contact" USING btree ("groupId");


--
-- Name: DistributorGroup_name_idx; Type: INDEX; Schema: distributor; Owner: evgenyarol
--

CREATE INDEX "DistributorGroup_name_idx" ON distributor."DistributorGroup" USING btree (lower(name));


--
-- Name: DistributorNote_distributorId_idx; Type: INDEX; Schema: distributor; Owner: evgenyarol
--

CREATE INDEX "DistributorNote_distributorId_idx" ON distributor."DistributorNote" USING btree ("distributorId");


--
-- Name: idx_distributor_group_owner; Type: INDEX; Schema: distributor; Owner: evgenyarol
--

CREATE INDEX idx_distributor_group_owner ON distributor."DistributorGroup" USING btree (owner_username);


--
-- Name: idx_distributor_group_pipeline_stage; Type: INDEX; Schema: distributor; Owner: evgenyarol
--

CREATE INDEX idx_distributor_group_pipeline_stage ON distributor."DistributorGroup" USING btree (pipeline_stage);


--
-- Name: idx_distributor_group_supplier; Type: INDEX; Schema: distributor; Owner: evgenyarol
--

CREATE INDEX idx_distributor_group_supplier ON distributor."DistributorGroup" USING btree (supplier);


--
-- Name: idx_distributor_group_tag; Type: INDEX; Schema: distributor; Owner: evgenyarol
--

CREATE INDEX idx_distributor_group_tag ON distributor."DistributorGroup" USING btree (tag);


--
-- Name: idx_material_distributor; Type: INDEX; Schema: distributor; Owner: evgenyarol
--

CREATE INDEX idx_material_distributor ON distributor.material USING btree (distributor_id);


--
-- Name: idx_campaign_lead_campaign; Type: INDEX; Schema: outreach; Owner: evgenyarol
--

CREATE INDEX idx_campaign_lead_campaign ON outreach.campaign_lead USING btree (campaign_id);


--
-- Name: idx_campaign_lead_person; Type: INDEX; Schema: outreach; Owner: evgenyarol
--

CREATE INDEX idx_campaign_lead_person ON outreach.campaign_lead USING btree (person_id);


--
-- Name: idx_webhook_log_provider; Type: INDEX; Schema: outreach; Owner: evgenyarol
--

CREATE INDEX idx_webhook_log_provider ON outreach.webhook_log USING btree (provider, processed_at DESC);


--
-- Name: idx_email_distributor; Type: INDEX; Schema: research; Owner: evgenyarol
--

CREATE INDEX idx_email_distributor ON research.email USING btree (distributor_id);


--
-- Name: idx_email_event_email; Type: INDEX; Schema: research; Owner: evgenyarol
--

CREATE INDEX idx_email_event_email ON research.email_event USING btree (email_id, occurred_at);


--
-- Name: idx_email_event_person; Type: INDEX; Schema: research; Owner: evgenyarol
--

CREATE INDEX idx_email_event_person ON research.email_event USING btree (person_id, occurred_at);


--
-- Name: idx_email_thread_dist; Type: INDEX; Schema: research; Owner: evgenyarol
--

CREATE INDEX idx_email_thread_dist ON research.email_thread USING btree (distributor_id, occurred_at);


--
-- Name: idx_email_thread_person; Type: INDEX; Schema: research; Owner: evgenyarol
--

CREATE INDEX idx_email_thread_person ON research.email_thread USING btree (person_id, occurred_at);


--
-- Name: idx_research_article_dist; Type: INDEX; Schema: research; Owner: evgenyarol
--

CREATE INDEX idx_research_article_dist ON research.article USING btree (distributor_id);


--
-- Name: idx_research_fact_dist; Type: INDEX; Schema: research; Owner: evgenyarol
--

CREATE INDEX idx_research_fact_dist ON research.fact USING btree (distributor_id);


--
-- Name: idx_research_flag_dist; Type: INDEX; Schema: research; Owner: evgenyarol
--

CREATE INDEX idx_research_flag_dist ON research.red_flag USING btree (distributor_id);


--
-- Name: idx_research_person_dist; Type: INDEX; Schema: research; Owner: evgenyarol
--

CREATE INDEX idx_research_person_dist ON research.person USING btree (distributor_id);


--
-- Name: idx_research_person_outreach; Type: INDEX; Schema: research; Owner: evgenyarol
--

CREATE INDEX idx_research_person_outreach ON research.person USING btree (outreach_status);


--
-- Name: idx_research_person_parent; Type: INDEX; Schema: research; Owner: evgenyarol
--

CREATE INDEX idx_research_person_parent ON research.person USING btree (parent_id);


--
-- Name: idx_run_distributor; Type: INDEX; Schema: research; Owner: evgenyarol
--

CREATE INDEX idx_run_distributor ON research.run USING btree (distributor_id);


--
-- Name: idx_run_status; Type: INDEX; Schema: research; Owner: evgenyarol
--

CREATE INDEX idx_run_status ON research.run USING btree (status);


--
-- Name: Branch Branch_groupId_fkey; Type: FK CONSTRAINT; Schema: distributor; Owner: evgenyarol
--

ALTER TABLE ONLY distributor."Branch"
    ADD CONSTRAINT "Branch_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES distributor."DistributorGroup"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Contact Contact_groupId_fkey; Type: FK CONSTRAINT; Schema: distributor; Owner: evgenyarol
--

ALTER TABLE ONLY distributor."Contact"
    ADD CONSTRAINT "Contact_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES distributor."DistributorGroup"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DistributorNote DistributorNote_distributorId_fkey; Type: FK CONSTRAINT; Schema: distributor; Owner: evgenyarol
--

ALTER TABLE ONLY distributor."DistributorNote"
    ADD CONSTRAINT "DistributorNote_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES distributor."DistributorGroup"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: material material_distributor_id_fkey; Type: FK CONSTRAINT; Schema: distributor; Owner: evgenyarol
--

ALTER TABLE ONLY distributor.material
    ADD CONSTRAINT material_distributor_id_fkey FOREIGN KEY (distributor_id) REFERENCES distributor."DistributorGroup"(id) ON DELETE CASCADE;


--
-- Name: campaign_lead campaign_lead_campaign_id_fkey; Type: FK CONSTRAINT; Schema: outreach; Owner: evgenyarol
--

ALTER TABLE ONLY outreach.campaign_lead
    ADD CONSTRAINT campaign_lead_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES outreach.campaign(id) ON DELETE CASCADE;


--
-- Name: campaign_lead campaign_lead_email_id_fkey; Type: FK CONSTRAINT; Schema: outreach; Owner: evgenyarol
--

ALTER TABLE ONLY outreach.campaign_lead
    ADD CONSTRAINT campaign_lead_email_id_fkey FOREIGN KEY (email_id) REFERENCES research.email(id) ON DELETE SET NULL;


--
-- Name: campaign_lead campaign_lead_person_id_fkey; Type: FK CONSTRAINT; Schema: outreach; Owner: evgenyarol
--

ALTER TABLE ONLY outreach.campaign_lead
    ADD CONSTRAINT campaign_lead_person_id_fkey FOREIGN KEY (person_id) REFERENCES research.person(id) ON DELETE SET NULL;


--
-- Name: email_event email_event_email_id_fkey; Type: FK CONSTRAINT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.email_event
    ADD CONSTRAINT email_event_email_id_fkey FOREIGN KEY (email_id) REFERENCES research.email(id) ON DELETE CASCADE;


--
-- Name: email_event email_event_person_id_fkey; Type: FK CONSTRAINT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.email_event
    ADD CONSTRAINT email_event_person_id_fkey FOREIGN KEY (person_id) REFERENCES research.person(id) ON DELETE SET NULL;


--
-- Name: email_thread email_thread_email_id_fkey; Type: FK CONSTRAINT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.email_thread
    ADD CONSTRAINT email_thread_email_id_fkey FOREIGN KEY (email_id) REFERENCES research.email(id) ON DELETE SET NULL;


--
-- Name: email_thread email_thread_person_id_fkey; Type: FK CONSTRAINT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.email_thread
    ADD CONSTRAINT email_thread_person_id_fkey FOREIGN KEY (person_id) REFERENCES research.person(id) ON DELETE SET NULL;


--
-- Name: fact fact_article_id_fkey; Type: FK CONSTRAINT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.fact
    ADD CONSTRAINT fact_article_id_fkey FOREIGN KEY (article_id) REFERENCES research.article(id) ON DELETE SET NULL;


--
-- Name: person person_parent_id_fkey; Type: FK CONSTRAINT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.person
    ADD CONSTRAINT person_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES research.person(id) ON DELETE SET NULL;


--
-- Name: person person_spouse_id_fkey; Type: FK CONSTRAINT; Schema: research; Owner: evgenyarol
--

ALTER TABLE ONLY research.person
    ADD CONSTRAINT person_spouse_id_fkey FOREIGN KEY (spouse_id) REFERENCES research.person(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict bIanXIhF8KrzBAJ0xEvKSFuaAwoWaLicHcpxhjoahgmD8uUaTmdp0mDNJlOYzXA

