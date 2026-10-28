// Photo sources for the App Review demo, oldest first.
//
// Each entry is a folder under `demo-source/` in the workout-images bucket
// holding selfie.jpg + environment.jpg, staged once from two real accounts
// (Curtis and his partner). Staging into a dedicated prefix means the demo
// survives those people deleting their own workouts or accounts. Avatars live
// at `demo-source/<name>.jpg` in the public avatars bucket.
//
// Captions are rewritten where the original was a dev/test note.

export type DemoSource = {
  folder: string;
  caption: string | null;
  primary: 'selfie' | 'environment';
};

export const MEMBER_SOURCES: DemoSource[] = [
  { folder: 'member-01', caption: 'post bball', primary: 'selfie' },
  { folder: 'member-02', caption: 'this past month killed my cardio', primary: 'selfie' },
  { folder: 'member-03', caption: 'post 4 mi run', primary: 'selfie' },
  { folder: 'member-04', caption: 'wya', primary: 'selfie' },
  { folder: 'member-05', caption: 'pigeon stretch', primary: 'selfie' },
  { folder: 'member-06', caption: null, primary: 'selfie' },
  { folder: 'member-07', caption: 'dying', primary: 'selfie' },
  { folder: 'member-08', caption: 'ur bbq chicken inspired me', primary: 'selfie' },
  { folder: 'member-09', caption: 'bag secured', primary: 'selfie' },
  { folder: 'member-10', caption: 'symphony time', primary: 'selfie' },
  { folder: 'member-11', caption: null, primary: 'selfie' },
  { folder: 'member-12', caption: null, primary: 'environment' },
  { folder: 'member-13', caption: 'miss our tues golf sessions', primary: 'selfie' },
];

export const PARTNER_SOURCES: DemoSource[] = [
  { folder: 'partner-01', caption: null, primary: 'selfie' },
  { folder: 'partner-02', caption: null, primary: 'selfie' },
  { folder: 'partner-03', caption: null, primary: 'selfie' },
  { folder: 'partner-04', caption: null, primary: 'selfie' },
  { folder: 'partner-05', caption: null, primary: 'selfie' },
  { folder: 'partner-06', caption: 'Leg press zzz', primary: 'selfie' },
  { folder: 'partner-07', caption: null, primary: 'selfie' },
];

export const MEMBER_AVATAR = 'demo-source/member.jpg';
export const PARTNER_AVATAR = 'demo-source/partner.jpg';
