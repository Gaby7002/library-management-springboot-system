CREATE TABLE lms.staff (
    id              SERIAL          PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NOT NULL,
    role            VARCHAR(20)     NOT NULL CHECK (role IN ('ADMIN', 'LIBRARIAN')),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    last_login      TIMESTAMPTZ     NULL,
    date_joined     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.staff IS 'System login users — admins and librarians only';

CREATE TABLE lms.members (
    id                  SERIAL          PRIMARY KEY,
    name                VARCHAR(100)    NOT NULL,
    email               VARCHAR(255)    NOT NULL UNIQUE,
    phone               VARCHAR(20)     NULL,
    address             TEXT            NULL,
    membership_status   VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE'
                            CHECK (membership_status IN ('ACTIVE', 'SUSPENDED', 'EXPIRED')),
    max_borrow_limit    INTEGER         NOT NULL DEFAULT 5,
    total_borrowed      INTEGER         NOT NULL DEFAULT 0,
    date_joined         TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.members IS 'Library members who can borrow books';

CREATE TABLE lms.books (
    id                  SERIAL          PRIMARY KEY,
    title               VARCHAR(255)    NOT NULL,
    author              VARCHAR(255)    NOT NULL,
    isbn                VARCHAR(13)     NOT NULL UNIQUE,
    publisher           VARCHAR(255)    NULL,
    page_count          INTEGER         NULL CHECK (page_count > 0),
    genre               VARCHAR(100)    NULL,
    category            VARCHAR(100)    NULL,
    shelf_location      VARCHAR(50)     NULL,
    total_copies        INTEGER         NOT NULL DEFAULT 1 CHECK (total_copies >= 0),
    available_copies    INTEGER         NOT NULL DEFAULT 1 CHECK (available_copies >= 0),
    status              VARCHAR(20)     NOT NULL DEFAULT 'AVAILABLE'
                            CHECK (status IN ('AVAILABLE', 'BORROWED', 'RESERVED', 'LOST')),
    date_added          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_copies CHECK (available_copies <= total_copies)
);

COMMENT ON TABLE lms.books IS 'Book inventory — all titles held by the library';

CREATE TABLE lms.loans (
    id              SERIAL          PRIMARY KEY,
    member_id       INTEGER         NOT NULL REFERENCES lms.members(id) ON DELETE RESTRICT,
    book_id         INTEGER         NOT NULL REFERENCES lms.books(id)   ON DELETE RESTRICT,
    issued_by_id    INTEGER         NULL     REFERENCES lms.staff(id)   ON DELETE SET NULL,
    issue_date      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    due_date        DATE            NOT NULL,
    return_date     DATE            NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'RETURNED', 'OVERDUE')),

    CONSTRAINT chk_due_after_issue CHECK (due_date > issue_date::DATE),
    CONSTRAINT chk_return_after_issue CHECK (return_date IS NULL OR return_date >= issue_date::DATE)
);

COMMENT ON TABLE lms.loans IS 'Book checkout records — one row per borrow transaction';

CREATE TABLE lms.fines (
    id          SERIAL          PRIMARY KEY,
    loan_id     INTEGER         NOT NULL UNIQUE REFERENCES lms.loans(id)   ON DELETE CASCADE,
    member_id   INTEGER         NOT NULL        REFERENCES lms.members(id) ON DELETE RESTRICT,
    amount      NUMERIC(8, 2)   NOT NULL CHECK (amount > 0),
    is_paid     BOOLEAN         NOT NULL DEFAULT FALSE,
    paid_date   TIMESTAMPTZ     NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_paid_date CHECK (
        (is_paid = FALSE AND paid_date IS NULL) OR
        (is_paid = TRUE  AND paid_date IS NOT NULL)
    )
);

COMMENT ON TABLE lms.fines IS 'Overdue fines — one fine per loan maximum';

CREATE TABLE lms.reservations (
    id              SERIAL          PRIMARY KEY,
    member_id       INTEGER         NOT NULL REFERENCES lms.members(id) ON DELETE CASCADE,
    book_id         INTEGER         NOT NULL REFERENCES lms.books(id)   ON DELETE CASCADE,
    reserved_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    queue_position  INTEGER         NOT NULL CHECK (queue_position > 0),
    status          VARCHAR(20)     NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'FULFILLED', 'CANCELLED')),
    expiry_date     DATE            NULL,

    CONSTRAINT chk_expiry_after_reservation 
        CHECK (expiry_date IS NULL OR expiry_date > reserved_at::DATE),
    CONSTRAINT uq_member_book_pending 
        UNIQUE (member_id, book_id)
);

COMMENT ON TABLE lms.reservations IS 'Reservation queue for unavailable books';

SELECT table_name 
FROM information_schema.tables
WHERE table_schema = 'lms'
ORDER BY table_name;

-- loans: most queried table
CREATE INDEX idx_loans_member_id  ON lms.loans(member_id);
CREATE INDEX idx_loans_book_id    ON lms.loans(book_id);
CREATE INDEX idx_loans_status     ON lms.loans(status);
CREATE INDEX idx_loans_due_date   ON lms.loans(due_date);

-- fines
CREATE INDEX idx_fines_member_id  ON lms.fines(member_id);
CREATE INDEX idx_fines_is_paid    ON lms.fines(is_paid);

-- reservations
CREATE INDEX idx_reservations_book    ON lms.reservations(book_id);
CREATE INDEX idx_reservations_member  ON lms.reservations(member_id);
CREATE INDEX idx_reservations_status  ON lms.reservations(status);

-- books
CREATE INDEX idx_books_isbn    ON lms.books(isbn);
CREATE INDEX idx_books_status  ON lms.books(status);
CREATE INDEX idx_books_title   ON lms.books(title);

-- members
CREATE INDEX idx_members_email   ON lms.members(email);
CREATE INDEX idx_members_status  ON lms.members(membership_status);

-- Read-only role (for reporting/analytics)
CREATE ROLE lms_readonly;

-- Application role (what your backend app uses)
CREATE ROLE lms_app;

GRANT USAGE ON SCHEMA lms TO lms_readonly, lms_app;

-- Read-only gets SELECT only
GRANT SELECT ON ALL TABLES IN SCHEMA lms TO lms_readonly;

CREATE USER lms_api_user  PASSWORD 'StrongPass@123' IN ROLE lms_app;
CREATE USER lms_read_user PASSWORD 'ReadOnly@456'   IN ROLE lms_readonly;

-- Check roles exist
SELECT rolname, rolcanlogin 
FROM pg_roles 
WHERE rolname IN ('lms_app', 'lms_readonly', 'lms_api_user', 'lms_read_user');

-- Check permissions on tables
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'lms'
ORDER BY grantee, table_name;

-- Enable RLS on sensitive tables
ALTER TABLE lms.loans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms.fines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms.reservations ENABLE ROW LEVEL SECURITY;

-- LOANS: members see only their own loans
CREATE POLICY loans_member_isolation ON lms.loans
    FOR SELECT
    USING (member_id = current_setting('app.current_member_id', TRUE)::INTEGER);

-- FINES: members see only their own fines
CREATE POLICY fines_member_isolation ON lms.fines
    FOR SELECT
    USING (member_id = current_setting('app.current_member_id', TRUE)::INTEGER);

-- RESERVATIONS: members see only their own reservations
CREATE POLICY reservations_member_isolation ON lms.reservations
    FOR SELECT
    USING (member_id = current_setting('app.current_member_id', TRUE)::INTEGER);

-- Staff bypass RLS entirely (admins see everything)
ALTER TABLE lms.loans        FORCE ROW LEVEL SECURITY;
ALTER TABLE lms.fines        FORCE ROW LEVEL SECURITY;
ALTER TABLE lms.reservations FORCE ROW LEVEL SECURITY;

-- App role gets full CRUD
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA lms TO lms_app;

-- App role needs sequence access for SERIAL primary keys
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA lms TO lms_app;

-- Set before every query for a logged-in member
SET app.current_member_id = '42';
SELECT * FROM lms.loans; -- returns only member 42's loans

CREATE OR REPLACE FUNCTION lms.update_book_availability()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE lms.books
        SET available_copies = available_copies - 1,
            status = CASE WHEN available_copies - 1 = 0 THEN 'BORROWED' ELSE 'AVAILABLE' END
        WHERE id = NEW.book_id;

    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'RETURNED' AND OLD.status != 'RETURNED' THEN
        UPDATE lms.books
        SET available_copies = available_copies + 1,
            status = 'AVAILABLE'
        WHERE id = NEW.book_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_book_availability
AFTER INSERT OR UPDATE ON lms.loans
FOR EACH ROW EXECUTE FUNCTION lms.update_book_availability();

CREATE OR REPLACE FUNCTION lms.update_member_borrow_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE lms.members
        SET total_borrowed = total_borrowed + 1
        WHERE id = NEW.member_id;

    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'RETURNED' AND OLD.status != 'RETURNED' THEN
        UPDATE lms.members
        SET total_borrowed = total_borrowed - 1
        WHERE id = NEW.member_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_member_borrow_count
AFTER INSERT OR UPDATE ON lms.loans
FOR EACH ROW EXECUTE FUNCTION lms.update_member_borrow_count();

CREATE OR REPLACE FUNCTION lms.generate_overdue_fine()
RETURNS TRIGGER AS $$
DECLARE
    days_overdue  INTEGER;
    fine_amount   NUMERIC(8,2);
    daily_rate    NUMERIC(8,2) := 0.50; -- 50 cents per day
BEGIN
    -- Only fire when status changes TO 'OVERDUE'
    IF NEW.status = 'OVERDUE' AND OLD.status != 'OVERDUE' THEN

        days_overdue := CURRENT_DATE - NEW.due_date;

        IF days_overdue > 0 THEN
            fine_amount := days_overdue * daily_rate;

            INSERT INTO lms.fines (loan_id, member_id, amount)
            VALUES (NEW.id, NEW.member_id, fine_amount)
            ON CONFLICT (loan_id) DO UPDATE
                SET amount = EXCLUDED.amount;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_overdue_fine
AFTER UPDATE ON lms.loans
FOR EACH ROW EXECUTE FUNCTION lms.generate_overdue_fine();

-- 1. All tables
SELECT table_name 
FROM information_schema.tables
WHERE table_schema = 'lms'
ORDER BY table_name;

-- 2. All indexes
SELECT indexname, tablename 
FROM pg_indexes
WHERE schemaname = 'lms'
ORDER BY tablename;

-- 3. All triggers
SELECT trigger_name, event_object_table, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'lms'
ORDER BY event_object_table;

-- 4. All roles and users
SELECT rolname, rolcanlogin
FROM pg_roles
WHERE rolname LIKE 'lms%';

-- Only index ACTIVE loans, not the thousands of returned ones
CREATE INDEX idx_loans_active ON lms.loans(member_id, due_date)
WHERE status = 'ACTIVE';

-- Only index UNPAID fines
CREATE INDEX idx_fines_unpaid ON lms.fines(member_id)
WHERE is_paid = FALSE;

CREATE TABLE lms.audit_log (
    id              BIGSERIAL       PRIMARY KEY,
    table_name      VARCHAR(50)     NOT NULL,
    record_id       INTEGER         NOT NULL,
    operation       VARCHAR(10)     NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data        JSONB           NULL,
    new_data        JSONB           NULL,
    changed_by      VARCHAR(100)    NOT NULL DEFAULT current_user,
    changed_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    ip_address      INET            NULL
);

COMMENT ON TABLE lms.audit_log IS 'Tracks every INSERT, UPDATE, DELETE across all sensitive tables';

-- Index for fast lookups
CREATE INDEX idx_audit_table_record ON lms.audit_log(table_name, record_id);
CREATE INDEX idx_audit_changed_at   ON lms.audit_log(changed_at);
CREATE INDEX idx_audit_changed_by   ON lms.audit_log(changed_by);

CREATE OR REPLACE FUNCTION lms.log_audit()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO lms.audit_log(table_name, record_id, operation, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW));

    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO lms.audit_log(table_name, record_id, operation, old_data, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO lms.audit_log(table_name, record_id, operation, old_data)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD));
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_staff
AFTER INSERT OR UPDATE OR DELETE ON lms.staff
FOR EACH ROW EXECUTE FUNCTION lms.log_audit();

CREATE TRIGGER trg_audit_members
AFTER INSERT OR UPDATE OR DELETE ON lms.members
FOR EACH ROW EXECUTE FUNCTION lms.log_audit();

CREATE TRIGGER trg_audit_books
AFTER INSERT OR UPDATE OR DELETE ON lms.books
FOR EACH ROW EXECUTE FUNCTION lms.log_audit();

CREATE TRIGGER trg_audit_loans
AFTER INSERT OR UPDATE OR DELETE ON lms.loans
FOR EACH ROW EXECUTE FUNCTION lms.log_audit();

CREATE TRIGGER trg_audit_fines
AFTER INSERT OR UPDATE OR DELETE ON lms.fines
FOR EACH ROW EXECUTE FUNCTION lms.log_audit();

CREATE TRIGGER trg_audit_reservations
AFTER INSERT OR UPDATE OR DELETE ON lms.reservations
FOR EACH ROW EXECUTE FUNCTION lms.log_audit();

SELECT table_name 
FROM information_schema.tables
WHERE table_schema = 'lms'
ORDER BY table_name;

ALTER TABLE lms.members ADD COLUMN deleted_at TIMESTAMPTZ NULL;
ALTER TABLE lms.books    ADD COLUMN deleted_at TIMESTAMPTZ NULL;

ALTER TABLE lms.books 
ADD CONSTRAINT chk_available_not_negative 
CHECK (available_copies >= 0);

-- Staff
INSERT INTO lms.staff (name, email, password_hash, role) VALUES
('Alice Admin',   'alice@library.com', 'hashed_pw_1', 'ADMIN'),
('Bob Librarian', 'bob@library.com',   'hashed_pw_2', 'LIBRARIAN'),
('Carol Lib',     'carol@library.com', 'hashed_pw_3', 'LIBRARIAN');

-- Members
INSERT INTO lms.members (name, email, phone, address) VALUES
('John Doe',     'john@example.com',  '0201234567', '12 Main St, Accra'),
('Jane Smith',   'jane@example.com',  '0557654321', '45 Oak Ave, Kumasi'),
('Peter Mensah', 'peter@example.com', '0241112233', '8 Beach Rd, Takoradi'),
('Ama Owusu',    'ama@example.com',   '0209988776', '3 Hill St, Cape Coast');

-- Verify
SELECT id, name, role FROM lms.staff;
SELECT id, name, membership_status, total_borrowed FROM lms.members;

INSERT INTO lms.books 
    (title, author, isbn, publisher, genre, category, shelf_location, total_copies, available_copies) 
VALUES
('Clean Code',               'Robert C. Martin', '9780132350884', 'Prentice Hall',  'Technology',  'Programming',  'A1-01', 3, 3),
('The Pragmatic Programmer', 'Andrew Hunt',       '9780201616224', 'Addison-Wesley', 'Technology',  'Programming',  'A1-02', 2, 2),
('Atomic Habits',            'James Clear',       '9780735211292', 'Avery',          'Self-Help',   'Productivity', 'B2-01', 5, 5),
('Deep Work',                'Cal Newport',       '9781455586691', 'Grand Central',  'Self-Help',   'Productivity', 'B2-02', 2, 2),
('The Great Gatsby',         'F. Scott Fitzgerald','9780743273565', 'Scribner',       'Fiction',     'Novel',        'C3-01', 4, 4),
('Things Fall Apart',        'Chinua Achebe',     '9780385474542', 'Anchor Books',   'Fiction',     'Novel',        'C3-02', 3, 3);

-- Verify
SELECT id, title, total_copies, available_copies, status 
FROM lms.books;

-- Create 3 loans
INSERT INTO lms.loans (member_id, book_id, issued_by_id, due_date) VALUES
(1, 1, 2, CURRENT_DATE + 14),  -- John borrows Clean Code
(2, 3, 2, CURRENT_DATE + 14),  -- Jane borrows Atomic Habits
(3, 1, 3, CURRENT_DATE + 7);   -- Peter borrows Clean Code (2nd copy)

-- NOW CHECK THE TRIGGERS FIRED:

-- Did available_copies decrease?
SELECT id, title, total_copies, available_copies, status 
FROM lms.books WHERE id IN (1, 3);

-- Did total_borrowed increase for members?
SELECT id, name, total_borrowed 
FROM lms.members WHERE id IN (1, 2, 3);

-- Did audit log capture everything?
SELECT table_name, operation, changed_at 
FROM lms.audit_log 
ORDER BY changed_at DESC LIMIT 10;

-- Simulate an overdue loan by backdating due_date
UPDATE lms.loans 
SET due_date = CURRENT_DATE - 5,
    status = 'OVERDUE'
WHERE id = 1;

-- Check fine was auto-generated
SELECT f.id, f.loan_id, f.member_id, f.amount, f.is_paid
FROM lms.fines f;

-- Amount should be 5 days × $0.50 = $2.50

-- Just mark it overdue without changing due_date
UPDATE lms.loans 
SET status = 'OVERDUE'
WHERE id = 1;

-- Check fine was auto-generated
SELECT f.id, f.loan_id, f.member_id, f.amount, f.is_paid
FROM lms.fines f;

-- Insert a backdated loan directly
INSERT INTO lms.loans (member_id, book_id, issued_by_id, issue_date, due_date, status)
VALUES (4, 2, 2, NOW() - INTERVAL '20 days', CURRENT_DATE - 7, 'OVERDUE');

-- Check fine
SELECT f.id, f.loan_id, f.member_id, f.amount, f.is_paid
FROM lms.fines f;
-- Amount should be 7 days × $0.50 = $3.50

-- Get the id of the backdated loan we just inserted
SELECT id, member_id, due_date, status FROM lms.loans;

-- Then update its status to force the trigger
-- (replace X with the actual id of the backdated loan)
UPDATE lms.loans 
SET status = 'OVERDUE'
WHERE id = (SELECT MAX(id) FROM lms.loans);

-- Now check fines
SELECT f.id, f.loan_id, f.member_id, f.amount, f.is_paid
FROM lms.fines f;

-- Fix the trigger to handle this correctly
CREATE OR REPLACE FUNCTION lms.generate_overdue_fine()
RETURNS TRIGGER AS $$
DECLARE
    days_overdue  INTEGER;
    fine_amount   NUMERIC(8,2);
    daily_rate    NUMERIC(8,2) := 0.50;
BEGIN
    IF NEW.status = 'OVERDUE' THEN
        days_overdue := CURRENT_DATE - NEW.due_date;

        IF days_overdue > 0 THEN
            fine_amount := days_overdue * daily_rate;

            INSERT INTO lms.fines (loan_id, member_id, amount)
            VALUES (NEW.id, NEW.member_id, fine_amount)
            ON CONFLICT (loan_id) DO UPDATE
                SET amount = EXCLUDED.amount;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Now force it to fire
UPDATE lms.loans 
SET status = 'ACTIVE'
WHERE id = (SELECT MAX(id) FROM lms.loans);

UPDATE lms.loans 
SET status = 'OVERDUE'
WHERE id = (SELECT MAX(id) FROM lms.loans);

-- Check fines now
SELECT f.id, f.loan_id, f.member_id, f.amount, f.is_paid
FROM lms.fines f;

-- View 1: All overdue loans with member and book details
CREATE VIEW lms.v_overdue_loans AS
SELECT 
    l.id            AS loan_id,
    m.name          AS member_name,
    m.email         AS member_email,
    b.title         AS book_title,
    l.due_date,
    CURRENT_DATE - l.due_date AS days_overdue,
    s.name          AS issued_by
FROM lms.loans l
JOIN lms.members m ON m.id = l.member_id
JOIN lms.books   b ON b.id = l.book_id
LEFT JOIN lms.staff s ON s.id = l.issued_by_id
WHERE l.status = 'OVERDUE';

-- View 2: All unpaid fines with member details
CREATE VIEW lms.v_unpaid_fines AS
SELECT
    f.id            AS fine_id,
    m.name          AS member_name,
    m.email         AS member_email,
    b.title         AS book_title,
    f.amount,
    f.created_at,
    CURRENT_DATE - f.created_at::DATE AS days_outstanding
FROM lms.fines f
JOIN lms.members m ON m.id = f.member_id
JOIN lms.loans   l ON l.id = f.loan_id
JOIN lms.books   b ON b.id = l.book_id
WHERE f.is_paid = FALSE;

-- View 3: Available books
CREATE VIEW lms.v_available_books AS
SELECT
    id,
    title,
    author,
    isbn,
    genre,
    shelf_location,
    available_copies
FROM lms.books
WHERE available_copies > 0
AND deleted_at IS NULL;

-- View 4: Member borrowing history
CREATE VIEW lms.v_member_history AS
SELECT
    m.name          AS member_name,
    b.title         AS book_title,
    l.issue_date,
    l.due_date,
    l.return_date,
    l.status,
    COALESCE(f.amount, 0) AS fine_amount,
    f.is_paid
FROM lms.loans l
JOIN lms.members m ON m.id = l.member_id
JOIN lms.books   b ON b.id = l.book_id
LEFT JOIN lms.fines f ON f.loan_id = l.id;

SELECT * FROM lms.v_overdue_loans;
SELECT * FROM lms.v_unpaid_fines;
SELECT * FROM lms.v_available_books;
SELECT * FROM lms.v_member_history;

CREATE OR REPLACE PROCEDURE lms.issue_book(
    p_member_id     INTEGER,
    p_book_id       INTEGER,
    p_staff_id      INTEGER,
    p_days          INTEGER DEFAULT 14
)
LANGUAGE plpgsql AS $$
BEGIN
    -- Check member is active
    IF NOT EXISTS (
        SELECT 1 FROM lms.members 
        WHERE id = p_member_id AND membership_status = 'ACTIVE'
    ) THEN
        RAISE EXCEPTION 'Member % is not active', p_member_id;
    END IF;

    -- Check book is available
    IF NOT EXISTS (
        SELECT 1 FROM lms.books 
        WHERE id = p_book_id AND available_copies > 0
    ) THEN
        RAISE EXCEPTION 'Book % has no available copies', p_book_id;
    END IF;

    -- Check member hasn't exceeded borrow limit
    IF (SELECT total_borrowed >= max_borrow_limit 
        FROM lms.members WHERE id = p_member_id) THEN
        RAISE EXCEPTION 'Member % has reached their borrow limit', p_member_id;
    END IF;

    -- Create the loan
    INSERT INTO lms.loans (member_id, book_id, issued_by_id, due_date)
    VALUES (p_member_id, p_book_id, p_staff_id, CURRENT_DATE + p_days);

    RAISE NOTICE 'Book % successfully issued to member %', p_book_id, p_member_id;
END;
$$;

CREATE OR REPLACE PROCEDURE lms.return_book(
    p_loan_id   INTEGER,
    p_staff_id  INTEGER
)
LANGUAGE plpgsql AS $$
BEGIN
    -- Check loan exists and is active
    IF NOT EXISTS (
        SELECT 1 FROM lms.loans 
        WHERE id = p_loan_id 
        AND status IN ('ACTIVE', 'OVERDUE')
    ) THEN
        RAISE EXCEPTION 'Loan % not found or already returned', p_loan_id;
    END IF;

    -- Mark loan as returned
    UPDATE lms.loans
    SET status      = 'RETURNED',
        return_date = CURRENT_DATE
    WHERE id = p_loan_id;

    RAISE NOTICE 'Loan % successfully returned', p_loan_id;
END;
$$;

CREATE OR REPLACE PROCEDURE lms.pay_fine(
    p_fine_id   INTEGER
)
LANGUAGE plpgsql AS $$
BEGIN
    -- Check fine exists and is unpaid
    IF NOT EXISTS (
        SELECT 1 FROM lms.fines 
        WHERE id = p_fine_id AND is_paid = FALSE
    ) THEN
        RAISE EXCEPTION 'Fine % not found or already paid', p_fine_id;
    END IF;

    -- Mark fine as paid
    UPDATE lms.fines
    SET is_paid   = TRUE,
        paid_date = NOW()
    WHERE id = p_fine_id;

    RAISE NOTICE 'Fine % successfully marked as paid', p_fine_id;
END;
$$;

-- Test 1: Issue a book (member 2, book 4, staff 1, 14 days)
CALL lms.issue_book(2, 4, 1, 14);

-- Verify book availability decreased
SELECT id, title, available_copies FROM lms.books WHERE id = 4;

-- Test 2: Return a loan (loan id 2)
CALL lms.return_book(2, 1);

-- Verify loan is marked returned
SELECT id, status, return_date FROM lms.loans WHERE id = 2;

-- Test 3: Pay the fine (fine id 1)
CALL lms.pay_fine(1);

-- Verify fine is marked paid
SELECT id, amount, is_paid, paid_date FROM lms.fines WHERE id = 1;

ALTER USER lms_api_user BYPASSRLs;

-- Grant access to all views
GRANT SELECT ON lms.v_member_history TO lms_api_user;
GRANT SELECT ON lms.v_overdue_loans TO lms_api_user;
GRANT SELECT ON lms.v_unpaid_fines TO lms_api_user;
GRANT SELECT ON lms.v_available_books TO lms_api_user;

-- Also reset the role
RESET ROLE;

SET ROLE lms_api_user;
SELECT * FROM lms.v_member_history;
-- Make sure you're running as postgres
SET ROLE postgres;

-- Grant all necessary permissions
GRANT INSERT, SELECT ON lms.audit_log TO lms_api_user;
GRANT USAGE, SELECT ON SEQUENCE lms.audit_log_id_seq TO lms_api_user;

-- Also grant to the procedure owner
GRANT INSERT, SELECT ON lms.audit_log TO PUBLIC;
-- Make sure you're running as postgres
SET ROLE postgres;

-- Grant all necessary permissions
GRANT INSERT, SELECT ON lms.audit_log TO lms_api_user;
GRANT USAGE, SELECT ON SEQUENCE lms.audit_log_id_seq TO lms_api_user;

-- Also grant to the procedure owner
GRANT INSERT, SELECT ON lms.audit_log TO PUBLIC;

-- Test the procedure
CALL lms.issue_book(1, 3, 2, 14);

SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'lms' AND routine_type = 'PROCEDURE';

CALL lms.issue_book(1, 3, 2, 14);

SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'library'
AND pid <> pg_backend_pid();

DO $$
BEGIN
    CALL lms.issue_book(1, 3, 2, 14);
END;
$$;

SELECT prosrc 
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'lms' 
AND p.proname = 'issue_book';

SELECT p.proname, pg_get_function_arguments(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'lms' AND p.proname = 'issue_book';