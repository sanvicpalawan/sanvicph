import type { Metadata, Viewport } from 'next';
import './globals.css';
import './owner-public.css';
export const metadata: Metadata = {title:'SANVIC 2027 · San Vicente, Palawan',description:'Slow down. Tune in. Explore the communities, beaches, and everyday moments of San Vicente, Palawan.',manifest:'/manifest.webmanifest',icons:{icon:'/favicon.svg',apple:'/icons/icon-192.png'},appleWebApp:{capable:true,statusBarStyle:'black-translucent',title:'SANVIC'}};
export const viewport: Viewport = {width:'device-width',initialScale:1,themeColor:'#061013'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
