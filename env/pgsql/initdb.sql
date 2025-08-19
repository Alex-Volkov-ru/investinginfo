CREATE SCHEMA pf;
ALTER SCHEMA pf OWNER TO bigs;
COMMENT ON SCHEMA pf IS 'portfolio schema';

ALTER ROLE bigs IN DATABASE bigsdb SET search_path TO pf;
