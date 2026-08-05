export interface Video {
  video_id: string;
  video_name: string;
  video_description: string | null;
  video_url: string;
  video_added_date: string;
  video_path: string;
  video_artwork_path?: string | null;
  video_chapters_path?: string | null;
  video_length: number;
}
