const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './educonsult.db';
const db = new Database(path.resolve(DB_PATH));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      avatar TEXT,
      phone TEXT,
      bio TEXT,
      is_active INTEGER DEFAULT 1,
      email_verified INTEGER DEFAULT 0,
      reset_token TEXT,
      reset_token_expires INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      short_description TEXT,
      thumbnail TEXT,
      level TEXT DEFAULT 'beginner',
      duration TEXT,
      price REAL DEFAULT 0,
      original_price REAL DEFAULT 0,
      instructor_id INTEGER REFERENCES users(id),
      instructor_name TEXT,
      category TEXT,
      tags TEXT,
      language TEXT DEFAULT 'English',
      certificate INTEGER DEFAULT 1,
      is_published INTEGER DEFAULT 0,
      is_featured INTEGER DEFAULT 0,
      total_lessons INTEGER DEFAULT 0,
      total_students INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      order_index INTEGER DEFAULT 0,
      is_preview INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      filename TEXT,
      original_name TEXT,
      file_size INTEGER,
      duration INTEGER,
      thumbnail TEXT,
      order_index INTEGER DEFAULT 0,
      is_free INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
      course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT,
      file_size INTEGER,
      file_type TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      course_id INTEGER NOT NULL REFERENCES courses(id),
      status TEXT DEFAULT 'active',
      progress INTEGER DEFAULT 0,
      completed_lessons TEXT DEFAULT '[]',
      payment_status TEXT DEFAULT 'paid',
      amount_paid REAL DEFAULT 0,
      enrolled_at INTEGER DEFAULT (unixepoch()),
      completed_at INTEGER,
      certificate_issued INTEGER DEFAULT 0,
      UNIQUE(user_id, course_id)
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      user_id INTEGER REFERENCES users(id),
      student_name TEXT NOT NULL,
      student_title TEXT,
      student_avatar TEXT,
      course_id INTEGER REFERENCES courses(id),
      course_name TEXT,
      content TEXT NOT NULL,
      rating INTEGER DEFAULT 5,
      before_achievement TEXT,
      after_achievement TEXT,
      is_featured INTEGER DEFAULT 0,
      is_approved INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'unread',
      replied_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS pricing_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      billing_cycle TEXT DEFAULT 'monthly',
      features TEXT DEFAULT '[]',
      is_popular INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS video_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      video_id INTEGER NOT NULL REFERENCES videos(id),
      progress_seconds INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      updated_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(user_id, video_id)
    );
  `);

  // Seed admin user
  const adminExists = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (!adminExists) {
    const { v4: uuidv4 } = require('uuid');
    const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'Admin@123456', 12);
    db.prepare(`
      INSERT INTO users (uuid, name, email, password, role, is_active, email_verified)
      VALUES (?, ?, ?, ?, 'admin', 1, 1)
    `).run(uuidv4(), 'Admin', process.env.ADMIN_EMAIL || 'admin@savetime.com', hashedPassword);
    console.log('Admin user created');
  }

  // Seed default settings
  const defaultSettings = [
    ['site_name', 'Save Time'],
    ['site_tagline', 'Save Time, Learn English Fast'],
    ['site_description', 'The fastest way to learn English online — expert-led courses for all levels'],
    ['contact_email', 'info@savetime.com'],
    ['contact_phone', '+1 (555) 123-4567'],
    ['contact_address', '123 Language Street, Learning City, LC 12345'],
    ['social_facebook', 'https://facebook.com/savetimeenglish'],
    ['social_twitter', 'https://twitter.com/savetimeenglish'],
    ['social_linkedin', 'https://linkedin.com/company/savetime'],
    ['social_youtube', 'https://youtube.com/savetime'],
    ['hero_title', 'Speak English Confidently — Faster Than You Think'],
    ['hero_subtitle', 'Join thousands of students who mastered English with Save Time. Expert-led lessons, proven methods, real results.'],
    ['stats_students', '12000'],
    ['stats_courses', '24'],
    ['stats_instructors', '8'],
    ['stats_satisfaction', '98'],
  ];
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of defaultSettings) {
    insertSetting.run(key, value);
  }

  // Seed English courses
  const courseCount = db.prepare('SELECT COUNT(*) as count FROM courses').get();
  if (courseCount.count === 0) {
    const { v4: uuidv4 } = require('uuid');
    const admin = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
    const sampleCourses = [
      {
        uuid: uuidv4(),
        title: 'English for Absolute Beginners',
        slug: 'english-absolute-beginners',
        description: 'Start from zero and build a solid English foundation. Learn the alphabet, basic grammar, essential vocabulary, and everyday conversations step by step.',
        short_description: 'Go from zero to basic English conversations in 8 weeks',
        level: 'beginner', duration: '8 weeks', price: 49, original_price: 99,
        instructor_name: 'Ms. Sarah Mitchell', category: 'English',
        tags: '["beginner","grammar","vocabulary","speaking"]',
        is_published: 1, is_featured: 1, total_lessons: 64, total_students: 3800, rating: 4.9, rating_count: 1120
      },
      {
        uuid: uuidv4(),
        title: 'Everyday English: Pre-Intermediate',
        slug: 'everyday-english-pre-intermediate',
        description: 'Build confidence in daily English situations — shopping, travel, making friends, and handling common real-life conversations with ease.',
        short_description: 'Master the English you need for everyday life',
        level: 'pre-intermediate', duration: '10 weeks', price: 69, original_price: 139,
        instructor_name: 'Mr. James Carter', category: 'English',
        tags: '["pre-intermediate","conversation","everyday"]',
        is_published: 1, is_featured: 1, total_lessons: 80, total_students: 2950, rating: 4.8, rating_count: 876
      },
      {
        uuid: uuidv4(),
        title: 'Intermediate English Fluency',
        slug: 'intermediate-english-fluency',
        description: 'Break through the intermediate plateau. Master complex grammar, expand your vocabulary, improve your listening, and start speaking fluently.',
        short_description: 'Go from intermediate to fluent English speaker',
        level: 'intermediate', duration: '12 weeks', price: 89, original_price: 179,
        instructor_name: 'Ms. Sarah Mitchell', category: 'English',
        tags: '["intermediate","fluency","grammar","speaking"]',
        is_published: 1, is_featured: 1, total_lessons: 96, total_students: 2100, rating: 4.9, rating_count: 654
      },
      {
        uuid: uuidv4(),
        title: 'Business English Professional',
        slug: 'business-english-professional',
        description: 'Communicate confidently in meetings, emails, presentations, and negotiations. Learn the professional English that gets you promoted.',
        short_description: 'Speak English like a professional in any business setting',
        level: 'upper-intermediate', duration: '10 weeks', price: 99, original_price: 199,
        instructor_name: 'Dr. Amanda Clarke', category: 'English',
        tags: '["business","professional","emails","presentations"]',
        is_published: 1, is_featured: 1, total_lessons: 80, total_students: 1750, rating: 4.9, rating_count: 543
      },
      {
        uuid: uuidv4(),
        title: 'IELTS Preparation — Band 7+',
        slug: 'ielts-preparation-band-7',
        description: 'Comprehensive IELTS prep covering all four skills: Reading, Writing, Listening, and Speaking. Proven strategies, full mock tests, and expert feedback.',
        short_description: 'Achieve Band 7+ on IELTS with our proven system',
        level: 'upper-intermediate', duration: '12 weeks', price: 119, original_price: 239,
        instructor_name: 'Mr. David Thompson', category: 'English',
        tags: '["ielts","exam","band7","academic"]',
        is_published: 1, is_featured: 1, total_lessons: 88, total_students: 1420, rating: 4.8, rating_count: 412
      },
      {
        uuid: uuidv4(),
        title: 'Advanced English Mastery',
        slug: 'advanced-english-mastery',
        description: 'Reach native-like fluency. Master advanced grammar, idiomatic expressions, academic writing, and nuanced communication skills.',
        short_description: 'Speak and write English at a near-native level',
        level: 'advanced', duration: '14 weeks', price: 129, original_price: 259,
        instructor_name: 'Dr. Amanda Clarke', category: 'English',
        tags: '["advanced","idioms","academic","writing"]',
        is_published: 1, is_featured: 1, total_lessons: 112, total_students: 980, rating: 4.9, rating_count: 298
      },
      {
        uuid: uuidv4(),
        title: 'English Pronunciation Bootcamp',
        slug: 'english-pronunciation-bootcamp',
        description: 'Eliminate your accent, perfect your pronunciation, and sound natural when you speak. Includes mouth exercises, minimal pairs, and shadowing techniques.',
        short_description: 'Sound like a native English speaker in 6 weeks',
        level: 'all-levels', duration: '6 weeks', price: 59, original_price: 119,
        instructor_name: 'Ms. Sarah Mitchell', category: 'English',
        tags: '["pronunciation","accent","speaking","phonetics"]',
        is_published: 1, is_featured: 0, total_lessons: 48, total_students: 2300, rating: 4.8, rating_count: 720
      },
      {
        uuid: uuidv4(),
        title: 'English for Job Interviews',
        slug: 'english-job-interviews',
        description: 'Master the English you need to ace job interviews in English-speaking companies. Common questions, smart answers, body language, and follow-ups.',
        short_description: 'Get hired with confident English interview skills',
        level: 'intermediate', duration: '4 weeks', price: 49, original_price: 89,
        instructor_name: 'Mr. James Carter', category: 'English',
        tags: '["job","interview","career","professional"]',
        is_published: 1, is_featured: 0, total_lessons: 32, total_students: 1650, rating: 4.7, rating_count: 490
      }
    ];
    const insertCourse = db.prepare(`
      INSERT INTO courses (uuid, title, slug, description, short_description, level, duration, price,
        original_price, instructor_id, instructor_name, category, tags, is_published, is_featured,
        total_lessons, total_students, rating, rating_count)
      VALUES (@uuid, @title, @slug, @description, @short_description, @level, @duration, @price,
        @original_price, ${admin.id}, @instructor_name, @category, @tags, @is_published, @is_featured,
        @total_lessons, @total_students, @rating, @rating_count)
    `);
    for (const course of sampleCourses) insertCourse.run(course);
    console.log('English courses seeded');
  }

  // Seed testimonials
  const testCount = db.prepare('SELECT COUNT(*) as count FROM testimonials').get();
  if (testCount.count === 0) {
    const { v4: uuidv4 } = require('uuid');
    const testimonials = [
      {
        uuid: uuidv4(), student_name: 'Ahmed Hassan', student_title: 'Software Engineer, Dubai',
        content: 'Save Time completely changed how I communicate at work. After the Business English course, I got promoted within 3 months because I could finally express my ideas clearly in meetings.',
        rating: 5, before_achievement: 'Struggled to speak in English meetings', after_achievement: 'Promoted to Team Lead, now leads English meetings', is_featured: 1
      },
      {
        uuid: uuidv4(), student_name: 'Maria Fernandez', student_title: 'University Student, Spain',
        content: 'I needed IELTS Band 7 to get into my dream university in the UK. The IELTS prep course was incredible — the strategies actually work. I got 7.5!',
        rating: 5, before_achievement: 'Scored Band 5.5 on first attempt', after_achievement: 'Achieved Band 7.5 and accepted to University of Leeds', is_featured: 1
      },
      {
        uuid: uuidv4(), student_name: 'Nguyen Van Minh', student_title: 'Business Owner, Vietnam',
        content: 'I was embarrassed to speak English with foreign clients. After 3 months with Save Time, I now have business calls in English every week. My business has grown 40% because of international clients.',
        rating: 5, before_achievement: 'Avoided all English-speaking clients', after_achievement: '40% business growth from international clients', is_featured: 1
      },
      {
        uuid: uuidv4(), student_name: 'Fatima Al-Rashid', student_title: 'Teacher, Saudi Arabia',
        content: 'The Beginners course is perfect — it starts from the very basics and builds up gently. The lessons are short but so effective. I learned more in 8 weeks here than in 2 years at school.',
        rating: 5, before_achievement: 'Could only write A-B-C in English', after_achievement: 'Now has daily conversations with English-speaking friends', is_featured: 1
      },
      {
        uuid: uuidv4(), student_name: 'Carlos Rivera', student_title: 'Marketing Manager, Mexico',
        content: 'The pronunciation course is a game changer. My colleagues used to ask me to repeat myself constantly. Now they compliment how clear my English is. The shadowing exercises really work.',
        rating: 5, before_achievement: 'Heavy accent, often misunderstood', after_achievement: 'Clear accent, leads English-language marketing presentations', is_featured: 0
      }
    ];
    const insertTest = db.prepare(`
      INSERT INTO testimonials (uuid, student_name, student_title, content, rating,
        before_achievement, after_achievement, is_featured)
      VALUES (@uuid, @student_name, @student_title, @content, @rating,
        @before_achievement, @after_achievement, @is_featured)
    `);
    for (const t of testimonials) insertTest.run(t);
    console.log('Testimonials seeded');
  }

  // Seed pricing plans
  const planCount = db.prepare('SELECT COUNT(*) as count FROM pricing_plans').get();
  if (planCount.count === 0) {
    const { v4: uuidv4 } = require('uuid');
    const plans = [
      {
        uuid: uuidv4(), name: 'Starter', description: 'Perfect for casual learners',
        price: 29, billing_cycle: 'monthly', is_popular: 0, is_active: 1,
        features: JSON.stringify(['Access to 3 beginner courses', 'HD video lessons', 'Certificate of completion', 'Community forum', 'Email support'])
      },
      {
        uuid: uuidv4(), name: 'Pro Learner', description: 'Best for serious students',
        price: 59, billing_cycle: 'monthly', is_popular: 1, is_active: 1,
        features: JSON.stringify(['Access to ALL courses', 'HD video lessons', 'All certificates', 'Live Q&A sessions (weekly)', '1-on-1 speaking practice (2/month)', 'Priority support', 'Downloadable worksheets'])
      },
      {
        uuid: uuidv4(), name: 'Group / Teams', description: 'For schools and organizations',
        price: 149, billing_cycle: 'monthly', is_popular: 0, is_active: 1,
        features: JSON.stringify(['Everything in Pro Learner', 'Up to 10 students', 'Progress reports', 'Group speaking sessions', 'Dedicated teacher', 'Custom lesson plans', 'Invoice billing'])
      }
    ];
    const insertPlan = db.prepare(`
      INSERT INTO pricing_plans (uuid, name, description, price, billing_cycle, features, is_popular, is_active)
      VALUES (@uuid, @name, @description, @price, @billing_cycle, @features, @is_popular, @is_active)
    `);
    for (const p of plans) insertPlan.run(p);
    console.log('Pricing plans seeded');
  }

  console.log('Database initialized successfully');
}

module.exports = { db, initializeDatabase };
