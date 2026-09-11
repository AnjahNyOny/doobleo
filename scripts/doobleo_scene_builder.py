import os
import sys
import json
import subprocess

# Pré-requis : pip install yt-dlp openai-whisper torch
# Note: ffmpeg doit également être installé sur votre système (brew install ffmpeg sur Mac)

try:
    import whisper
except ImportError:
    print("Erreur : Veuillez installer les dépendances manquantes.")
    print("Exécutez : pip install yt-dlp openai-whisper torch demucs")
    sys.exit(1)

import shutil
import ssl

# Fix for macOS Python SSL Certificate errors when downloading models
ssl._create_default_https_context = ssl._create_unverified_context

def download_audio_and_video(url: str) -> tuple[str, str]:
    print(f"📥 Téléchargement de la vidéo et de l'audio depuis {url}...")
    
    # Création du dossier scenes
    os.makedirs("scenes", exist_ok=True)
    
    # Résolution du chemin de yt-dlp (gère les Mac Apple Silicon / Homebrew)
    yt_dlp_path = shutil.which("yt-dlp") or "/opt/homebrew/bin/yt-dlp"
    
    if not os.path.exists(yt_dlp_path):
        print("Erreur : yt-dlp est introuvable. Avez-vous exécuté 'brew install yt-dlp' ?")
        sys.exit(1)
    
    # Téléchargement de la vidéo au format mp4
    print("🎥 Téléchargement de la vidéo mp4...")
    subprocess.run([
        yt_dlp_path,
        "-f", "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "-o", "scenes/scene_video.%(ext)s",
        url
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    
    # Extraction de l'audio pour Whisper
    print("🎵 Extraction de l'audio...")
    subprocess.run([
        yt_dlp_path,
        "-x", "--audio-format", "mp3",
        "-o", "scenes/temp_audio.%(ext)s",
        url
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    
    return "scenes/temp_audio.mp3", "scenes/scene_video.mp4"

def transcribe_audio_local(audio_path: str):
    print("🤖 Chargement du modèle Whisper local (gratuit)... cela peut prendre quelques secondes la première fois.")
    # Le modèle 'small' est un bon compromis vitesse/précision pour tourner sur CPU
    model = whisper.load_model("small")
    
    print("✍️ Transcription de l'audio en cours...")
    result = model.transcribe(audio_path, language="fr", fp16=False)
    return result["segments"]

def separate_audio_local(audio_path: str) -> tuple[str, str]:
    print("🎵 Séparation de l'audio avec Demucs (Cela peut prendre un peu de temps sur CPU)...")
    try:
        subprocess.run([
            sys.executable, "-m", "demucs.separate", 
            "-n", "htdemucs", 
            "--two-stems", "vocals", 
            "-d", "cpu", 
            "-o", "scenes", 
            audio_path
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
        
        # Demucs place les fichiers dans: scenes/htdemucs/<nom_fichier>/
        base_name = os.path.splitext(os.path.basename(audio_path))[0]
        out_dir = os.path.join("scenes", "htdemucs", base_name)
        
        me_path = os.path.join("scenes", "scene_me.wav")
        vocals_path = os.path.join("scenes", "scene_vocals.wav")
        
        shutil.move(os.path.join(out_dir, "no_vocals.wav"), me_path)
        shutil.move(os.path.join(out_dir, "vocals.wav"), vocals_path)
        
        # Cleanup du dossier temporaire de demucs
        shutil.rmtree(os.path.join("scenes", "htdemucs"), ignore_errors=True)
        
        return me_path, vocals_path
    except Exception as e:
        print(f"Erreur lors de la séparation Demucs: {e}")
        return "", ""

def build_doobleo_json(segments: list) -> str:
    print("🧠 Formatage du JSON pour Doobleo...")
    
    # On crée un personnage par défaut
    default_char_id = "char-unknown"
    
    data = {
        "version": 1,
        "characters": [
            {
                "id": default_char_id,
                "name": "À définir",
                "color": "#94a3b8",
                "description": "Personnage générique à assigner"
            }
        ],
        "lines": []
    }
    
    order = 1
    for segment in segments:
        text = segment["text"].strip()
        if not text:
            continue
            
        start_ms = int(segment["start"] * 1000)
        end_ms = int(segment["end"] * 1000)
        
        data["lines"].append({
            "id": f"line-{order}",
            "characterId": default_char_id,
            "text": text,
            "startMs": start_ms,
            "endMs": end_ms,
            "order": order
        })
        order += 1
        
    return json.dumps(data, indent=2, ensure_ascii=False)

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/doobleo_scene_builder.py <URL_YOUTUBE_OU_DAILYMOTION>")
        sys.exit(1)
        
    # Nettoyage de l'URL (si l'utilisateur a collé avec des antislashs depuis son terminal)
    url = sys.argv[1].replace("\\", "")
    
    try:
        audio_file, video_file = download_audio_and_video(url)
        segments = transcribe_audio_local(audio_file)
        
        # Séparation de la musique et des effets
        me_file, vocals_file = separate_audio_local(audio_file)
        
        json_result = build_doobleo_json(segments)
        
        # Sauvegarde du résultat final
        json_path = "scenes/scene_import.json"
        with open(json_path, "w", encoding="utf-8") as f:
            f.write(json_result)
            
        print("✅ Terminé !")
        print(f"🎥 Vidéo téléchargée : {video_file}")
        print(f"📄 Sous-titres JSON : {json_path}")
        if me_file:
            print(f"🎧 Piste M&E (Musique et Effets) : {me_file}")
        print("\n💡 Étape suivante : Créez une scène dans l'admin Doobleo, uploadez la vidéo mp4, la piste M&E, puis allez dans l'onglet 'Répliques' et importez le JSON !")
        
    except Exception as e:
        print(f"❌ Une erreur est survenue : {e}")
    finally:
        # Nettoyage
        if os.path.exists("scenes/temp_audio.mp3"):
            os.remove("scenes/temp_audio.mp3")

if __name__ == "__main__":
    main()
