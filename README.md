# Snap2Invoice

Transform receipt photos into professional invoices with AI-powered OCR processing.

## Features

- **🔐 User Authentication**: Secure sign-up/sign-in with Supabase Auth
- **📸 Receipt Upload**: Drag-and-drop or click to upload receipt images
- **🔍 OCR Processing**: Automatic text extraction from receipts using Tesseract.js
- **📄 Invoice Generation**: Convert receipts to professional, editable invoices
- **✏️ Invoice Editing**: Full CRUD operations for invoice items, client details, and notes
- **💰 Subscription Tiers**: 
  - **Free**: 3 invoices per month
  - **Premium**: Unlimited invoices + custom business logo
- **📊 Usage Tracking**: Monthly invoice limits with automatic reset
- **🏢 Business Branding**: Custom logo upload for premium users
- **📱 Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage
- **OCR**: Tesseract.js
- **Deployment**: Vercel-ready

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- A Supabase account and project

### 1. Environment Setup

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 2. Supabase Database Setup

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the SQL from `database/schema.sql` to create all necessary tables, policies, and functions

### 3. Supabase Storage Setup

1. In Supabase Dashboard, go to Storage
2. Create a new bucket named `receipts`
3. Make it public
4. Set up the storage policies (examples are in the schema.sql file)

### 4. Install Dependencies

```bash
npm install
```

### 5. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## Project Structure

```
src/
├── app/                    # Next.js 13+ app directory
│   ├── api/
│   │   └── upload/        # File upload API endpoint
│   ├── auth/              # Authentication pages
│   ├── invoices/          # Invoice management pages
│   │   └── [id]/          # Individual invoice editor
│   ├── upload/            # Receipt upload page
│   ├── account/           # User account management
│   ├── layout.js          # Root layout with AuthProvider
│   ├── page.js            # Home page
│   └── supabaseClient.js  # Supabase configuration
├── components/            # Reusable React components
│   ├── Auth.js           # Sign in/up component
│   └── Navigation.js     # Main navigation
├── contexts/             # React contexts
│   └── AuthContext.js    # Authentication state management
└── utils/                # Utility functions
    └── ocr.js            # OCR processing utilities
```

## Key Features Explained

### Authentication Flow

1. Users sign up/sign in using email and password
2. Supabase automatically creates a user profile on sign-up
3. All routes are protected and redirect to `/auth` if not authenticated
4. Navigation shows different options based on authentication status

### Receipt Processing

1. User uploads a receipt image (drag & drop or file picker)
2. System checks monthly usage limits for free users
3. Image is uploaded to Supabase Storage with user-specific folder structure
4. Tesseract.js processes the image to extract text
5. Custom algorithms parse the OCR text to identify:
   - Merchant name
   - Individual items and prices
   - Total amount
   - Tax amount
   - Date

### Invoice Management

1. Successfully processed receipts automatically create draft invoices
2. Users can edit all aspects of the invoice:
   - Client information
   - Invoice items (description, quantity, rate)
   - Tax rates
   - Due dates
   - Additional notes
3. Real-time calculations for subtotals, tax, and totals
4. Auto-save functionality for seamless editing

### Subscription System

- **Free Plan**: 3 invoices per month, resets automatically
- **Premium Plan**: Unlimited invoices + custom logo upload
- Monthly usage tracking with automatic reset
- Easy upgrade/downgrade functionality (demo mode - no payment processing)

## Database Schema

### Core Tables

- `user_profiles`: Extended user information and subscription details
- `receipts`: Uploaded receipt files and OCR results
- `invoices`: Generated invoices with full details
- `subscription_plan` enum: 'free' or 'premium'
- `invoice_status` enum: 'draft', 'sent', 'paid', 'cancelled'

### Security

- Row Level Security (RLS) enabled on all tables
- Users can only access their own data
- Secure file upload with user-specific folder structure

## Development Notes

### Adding Payment Processing

To add real payment processing (Stripe, PayPal, etc.):

1. Update the `upgradeToPremium` function in `/src/app/account/page.js`
2. Add webhook endpoints to handle subscription events
3. Implement proper subscription management

### Extending OCR Capabilities

Current OCR uses Tesseract.js. For better accuracy:

1. Consider Google Cloud Vision API or AWS Textract
2. Update `/src/utils/ocr.js` with new OCR service
3. Implement fallback mechanisms for failed OCR processing

### PDF Generation

The current "Preview/Print" uses `window.print()`. For PDF generation:

1. Add jsPDF or Puppeteer
2. Create invoice templates
3. Implement download/email functionality

## Deployment

### Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on git push

### Manual Deployment

```bash
npm run build
npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For questions or issues:
1. Check the documentation
2. Review the database schema
3. Examine the API endpoints
4. Open an issue in the repository

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
