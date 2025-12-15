import requests
from bs4 import BeautifulSoup
import json
import os
import time
from github import Github, GithubException

# --- CONFIGURACIÓN ---

# 1. URL de la clasificación
URL_BASE = "https://www2.ecmadrid.org"
URL_OBJETIVO = f"{URL_BASE}/Deportesdev/Clasificacion/_ShowClasif?numcom=89&depor=FUTBOL-SALA&categ=ALEVIN%20MIXTO"

# 2. Configuración de GitHub
# IMPORTANTE: Usa un Personal Access Token (PAT).
GITHUB_TOKEN = "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" 
REPO_NAME = "inijimenez/inijimenez.github.io" 
RUTA_ARCHIVO_JSON_REPO = "datos/clasificacion.json" 
CARPETA_IMAGENES_REPO = "img/escudos" # Carpeta en GitHub donde irán las imágenes

# 3. Archivo local
ARCHIVO_LOCAL = "clasificacion_local.json"
CARPETA_IMAGENES_LOCAL = "escudos" # Carpeta local

def descargar_imagen(url_imagen, nombre_archivo):
    """Descarga una imagen y la guarda localmente."""
    if not url_imagen:
        return False
        
    ruta_local = os.path.join(CARPETA_IMAGENES_LOCAL, nombre_archivo)
    
    # Si ya existe, no la descargamos de nuevo para ahorrar tiempo/ancho de banda
    if os.path.exists(ruta_local):
        return True

    try:
        # Asegurar que la carpeta existe
        if not os.path.exists(CARPETA_IMAGENES_LOCAL):
            os.makedirs(CARPETA_IMAGENES_LOCAL)

        print(f"Descargando nueva imagen: {nombre_archivo}...")
        response = requests.get(url_imagen, stream=True)
        if response.status_code == 200:
            with open(ruta_local, 'wb') as f:
                for chunk in response.iter_content(1024):
                    f.write(chunk)
            return True
    except Exception as e:
        print(f"Error descargando imagen {url_imagen}: {e}")
    
    return False

def subir_imagen_github(repo, ruta_local, nombre_archivo):
    """Sube una imagen binaria a GitHub si no existe o ha cambiado."""
    ruta_repo = f"{CARPETA_IMAGENES_REPO}/{nombre_archivo}"
    mensaje = f"Subida de escudo: {nombre_archivo}"
    
    with open(ruta_local, "rb") as f:
        content = f.read()

    try:
        # Intentar obtener archivo existente
        contents = repo.get_contents(ruta_repo)
        print(f"Imagen ya existe en GitHub: {ruta_repo}")
    except GithubException as e:
        if e.status == 404:
            # No existe, crear
            repo.create_file(ruta_repo, mensaje, content)
            print(f"Imagen subida a GitHub: {ruta_repo}")
        else:
            print(f"Error GitHub con imagen {nombre_archivo}: {e}")

def procesar_url_imagen(img_tag):
    """Extrae, limpia y devuelve la URL completa y el nombre del archivo."""
    if not img_tag:
        return None, None
    
    src = img_tag.get('src', '')
    if not src:
        return None, None
        
    # Limpieza de URL (a veces vienen con doble //)
    src_limpia = src.replace('//', '/')
    
    # Construir URL absoluta
    url_completa = f"{URL_BASE}{src_limpia}" if src_limpia.startswith('/') else src_limpia
    
    # Extraer nombre de archivo (ej: Emblema_0143.jpg)
    nombre_archivo = os.path.basename(src_limpia)
    
    return url_completa, nombre_archivo

def obtener_datos_web(url):
    """Descarga la web, extrae datos y gestiona las imágenes."""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        print(f"Conectando a {url}...")
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        datos_totales = {
            "clasificacion": [],
            "jornadas": []
        }
        
        imagenes_procesadas = set()

        # Búsqueda más robusta de los títulos de grupo
        headers_grupo = []
        for h3 in soup.find_all('h3'):
            if "GRUPO:" in h3.get_text():
                headers_grupo.append(h3)
        
        if not headers_grupo:
            print("Error: No se encontraron encabezados de 'GRUPO:'.")
            return None, []

        print(f"Se encontraron {len(headers_grupo)} bloques de grupos.")

        for h3 in headers_grupo:
            grupo_nombre = h3.text.strip()
            
            for sibling in h3.find_next_siblings():
                # Si encontramos otro título, paramos de leer este grupo
                if sibling.name == 'h3':
                    break
                
                # Procesamos solo divs con clase col-xs-12
                if sibling.name == 'div' and 'col-xs-12' in sibling.get('class', []):
                    
                    # CRÍTICO: Ignorar las filas de cabecera que tienen la clase 'encuentro'
                    if 'encuentro' in sibling.get('class', []):
                        continue

                    columnas = sibling.find_all('div', recursive=False)
                    
                    # --- TIPO 1: Clasificación ---
                    # Identificación: El nombre del equipo ocupa 3 columnas (col-xs-3) en el índice 1
                    if len(columnas) >= 10 and 'col-xs-3' in columnas[1].get('class', []):
                        
                        url_img, nombre_img = procesar_url_imagen(columnas[0].find('img'))
                        ruta_final_img = ""
                        
                        if url_img and nombre_img:
                            descargar_imagen(url_img, nombre_img)
                            imagenes_procesadas.add(nombre_img)
                            ruta_final_img = f"{CARPETA_IMAGENES_REPO}/{nombre_img}"

                        equipo = {
                            "Grupo": grupo_nombre,
                            "Escudo": ruta_final_img,
                            "Equipo": columnas[1].text.strip(),
                            "J": columnas[2].text.strip(),
                            "G": columnas[3].text.strip(),
                            "E": columnas[4].text.strip(),
                            "P": columnas[5].text.strip(),
                            "TF": columnas[6].text.strip(),
                            "TC": columnas[7].text.strip(),
                            "AVG": columnas[8].text.strip(),
                            "Puntos": columnas[9].text.strip()
                        }
                        datos_totales["clasificacion"].append(equipo)

                    # --- TIPO 2: Jornada / Partido ---
                    # Identificación: El equipo Local ocupa 2 columnas (col-xs-2) en el índice 2
                    elif len(columnas) >= 10 and 'col-xs-2' in columnas[2].get('class', []):
                        
                        # Escudo Local (Índice 1)
                        url_local, nombre_local = procesar_url_imagen(columnas[1].find('img'))
                        ruta_final_local = ""
                        if url_local and nombre_local:
                            descargar_imagen(url_local, nombre_local)
                            imagenes_procesadas.add(nombre_local)
                            ruta_final_local = f"{CARPETA_IMAGENES_REPO}/{nombre_local}"

                        # Escudo Visitante (Índice 4)
                        url_visit, nombre_visit = procesar_url_imagen(columnas[4].find('img'))
                        ruta_final_visit = ""
                        if url_visit and nombre_visit:
                            descargar_imagen(url_visit, nombre_visit)
                            imagenes_procesadas.add(nombre_visit)
                            ruta_final_visit = f"{CARPETA_IMAGENES_REPO}/{nombre_visit}"

                        partido = {
                            "Grupo": grupo_nombre,
                            "Jornada": columnas[0].text.strip(),
                            "EscudoLocal": ruta_final_local,
                            "Local": columnas[2].text.strip(),
                            "GolesLocal": columnas[3].text.strip(),
                            "EscudoVisitante": ruta_final_visit,
                            "Visitante": columnas[5].text.strip(),
                            "GolesVisitante": columnas[6].text.strip(),
                            "Fecha": columnas[7].text.strip(),
                            "Hora": columnas[8].text.strip(),
                            "Direccion": columnas[9].text.strip()
                        }
                        datos_totales["jornadas"].append(partido)

        return datos_totales, list(imagenes_procesadas)

    except Exception as e:
        print(f"Error al hacer scraping: {e}")
        return None, []

def guardar_local(datos, nombre_archivo):
    with open(nombre_archivo, 'w', encoding='utf-8') as f:
        json.dump(datos, f, ensure_ascii=False, indent=4)
    print(f"Datos guardados localmente en {nombre_archivo}")

def leer_local(nombre_archivo):
    if not os.path.exists(nombre_archivo):
        return None
    try:
        with open(nombre_archivo, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return None

def sincronizar_github(datos_json, lista_imagenes, token, repo_name, path_json):
    """Sube JSON y todas las imágenes nuevas a GitHub."""
    try:
        g = Github(token)
        repo = g.get_repo(repo_name)
        
        # 1. Subir imágenes primero
        print(f"Verificando {len(lista_imagenes)} imágenes en GitHub...")
        for nombre_img in lista_imagenes:
            ruta_local = os.path.join(CARPETA_IMAGENES_LOCAL, nombre_img)
            if os.path.exists(ruta_local):
                subir_imagen_github(repo, ruta_local, nombre_img)
        
        # 2. Subir JSON
        contenido_json = json.dumps(datos_json, ensure_ascii=False, indent=4)
        mensaje_commit = "Actualización automática: Datos y Escudos"
        
        try:
            contents = repo.get_contents(path_json)
            contenido_actual = contents.decoded_content.decode('utf-8')
            
            if contenido_actual == contenido_json:
                print("El JSON en GitHub ya está actualizado.")
            else:
                repo.update_file(contents.path, mensaje_commit, contenido_json, contents.sha)
                print(f"JSON actualizado en GitHub: {path_json}")
                
        except GithubException as e:
            if e.status == 404:
                repo.create_file(path_json, mensaje_commit, contenido_json)
                print(f"JSON creado en GitHub: {path_json}")
            else:
                raise e
                
    except Exception as e:
        print(f"Error al sincronizar con GitHub: {e}")

def main():
    print("Iniciando proceso...")
    
    # Obtenemos datos y la lista de nombres de imágenes descargadas
    nuevos_datos, imagenes_descargadas = obtener_datos_web(URL_OBJETIVO)
    
    if not nuevos_datos:
        print("No se extrajeron datos. Abortando.")
        return

    n_clasif = len(nuevos_datos.get("clasificacion", []))
    n_jornadas = len(nuevos_datos.get("jornadas", []))
    print(f"Se extrajeron {n_clasif} registros de clasificación y {n_jornadas} partidos.")

    datos_antiguos = leer_local(ARCHIVO_LOCAL)
    
    # Detectar cambios
    cambios_datos = datos_antiguos != nuevos_datos
    
    if cambios_datos:
        print("¡Se han detectado cambios en los datos!")
        guardar_local(nuevos_datos, ARCHIVO_LOCAL)
    else:
        print("No hay cambios en los datos de texto.")

    # Sincronización
    if "TOKEN" in GITHUB_TOKEN:
        print("⚠️ ADVERTENCIA: Configura tu Token de GitHub para subir los datos.")
    else:
        sincronizar_github(nuevos_datos, imagenes_descargadas, GITHUB_TOKEN, REPO_NAME, RUTA_ARCHIVO_JSON_REPO)

if __name__ == "__main__":
    main()