# Copyright 2026 Comcast Cable Communications Management, LLC
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# SPDX-License-Identifier: Apache-2.0

from typing import Optional, Dict, List, Set
from arcgis.gis import GIS
import argparse
import sys
import os
from arcgis.apps import itemgraph
import json
import tempfile
import re
import logging

logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

# SSL Certificate Configuration:
# If your ArcGIS Enterprise uses self-signed or internal CA certificates,
# configure the custom CA bundle using environment variables instead of
# disabling SSL verification:
#   export REQUESTS_CA_BUNDLE=/path/to/enterprise-ca.pem
#   export SSL_CERT_FILE=/path/to/enterprise-ca.pem
# Do NOT suppress InsecureRequestWarning - it indicates SSL verification issues

# Constants
SITE_APPLICATION_TYPE = "Site Application"
STORYMAP_TYPE = "StoryMap"
JSON_EXTENSION = ".json"
SEARCH_MAX_ITEMS = 5

def validate_environments(source_env: str, target_env: str) -> None:
    if source_env == target_env:
        raise ValueError("Source and target environments cannot be the same")
    
def safe_url_parse(url: str) -> Optional[str]:
    try:
        parts = url.strip('/').split('/')
        return parts[-2] if len(parts) >= 2 else None
    except (IndexError, AttributeError):
        return None
    
def safe_json_loads(json_str: str) -> Optional[Dict]:
    try:
        return json.loads(json_str) if json_str else None
    except json.JSONDecodeError:
        return None

def get_env_name_from_url(url: str) -> str:
    # Load URL to environment name mapping from config file
    url_mapping_path = os.path.join(os.path.dirname(__file__), "../config/url-mapping.json")
    
    if not os.path.exists(url_mapping_path):
        logger.warning(f"url-mapping.json not found at {url_mapping_path}")
        return "unknown"
    
    try:
        with open(url_mapping_path, "r") as f:
            url_mapping = json.load(f)
        
        for env_name, env_url in url_mapping.items():
            if env_url in url:
                return env_name
        
        return "unknown"
    except Exception as e:
        logger.error(f"Error reading URL mapping config: {e}")
        return "unknown"

def get_missing_dependencies(source_gis: GIS, target_gis: GIS, item_id: str, visited: Optional[Set[str]] = None, missing: Optional[List[str]] = None) -> List[str]:
    if visited is None:
        visited = set()
    if missing is None:
        missing = []
    if item_id in visited:
        return missing
    visited.add(item_id)
    try:
        item = source_gis.content.get(item_id)
        if not item:
            return missing
    except Exception:
        return missing

    target_item = target_gis.content.get(item_id)
    if not target_item:
        missing.append(item_id)

    dependencies = []
    try:
        itemgraph_obj = itemgraph.create_dependency_graph(source_gis, [item_id])
        for rel in itemgraph_obj.all_items():
            if rel.id != item_id:
                dependencies.append(rel.id)
    except Exception:
        pass
    for dep_id in dependencies:
        get_missing_dependencies(source_gis, target_gis, dep_id, visited, missing)
    return missing


def share_groups(itemid: str, target_gis: GIS, source_id: str, source_gis: GIS) -> None:
    item = target_gis.content.get(itemid)
    source_item = source_gis.content.get(source_id)
    if not item or not source_item:
        #logger.warning(f"Item {source_id} not found in source or target GIS for sharing groups.")
        return
    # Share item with same level as source
    original_level = source_item.sharing.shared_with['level']
    logger.debug(f"Setting sharing level to {original_level} for item {itemid}")
    item.sharing.sharing_level = original_level 

    original_groups = source_item.sharing.groups.list()
    #logger.debug(f"Original groups for item {source_id}: {[g['title'] for g in original_groups]}")
    grp_sharing_mgr = item.sharing.groups
    for source_group in original_groups:
        #logger.debug(f"Processing group '{source_group['title']}' for sharing.")
        # find group in target gis with same name
        target_groups = target_gis.groups.search(query=f"title:{source_group['title']}", max_groups=SEARCH_MAX_ITEMS)
        target_group = None
        if target_groups:
            for tg in target_groups:
                if tg.title == source_group['title']:
                    target_group = tg
                    break
        if target_group:
            #logger.debug(f"Found existing group '{target_group.title}' in target GIS for sharing.")
            # temporarily reassign group to current user if needed
            original_owner = target_group.owner
            if target_group.owner != target_gis.users.me.username:
                target_group.reassign_to(target_gis.users.me.username)
            grp_sharing_mgr.add(group=target_group)
            logger.debug(f"Shared item {itemid} with existing group '{source_group['title']}' in target GIS.")
            # revert group ownership back to original owner
            if target_group.owner != original_owner:
                target_group.reassign_to(original_owner)
        else:
            # create group in target gis
            logger.debug(f"Creating new group '{source_group['title']}' in target GIS for sharing.")
            with tempfile.TemporaryDirectory() as temp_dir:
                new_group = target_gis.groups.create(title = source_group['title'],
                                            tags = source_group['tags'],
                                            description = source_group['description'],
                                            snippet = source_group['snippet'],
                                            access = source_group['access'], 
                                            thumbnail = source_group.download_thumbnail(temp_dir),
                                            is_invitation_only = source_group['isInvitationOnly'],
                                            sort_field = source_group['sortField'],
                                            sort_order = source_group['sortOrder'],
                                            is_view_only = source_group['isViewOnly'],
                                            auto_join = source_group['autoJoin']
                                            )
            new_group.protected = source_group['protected']
            response = source_group.get_members()
            if 'users' in response:
                new_group.add_users(response['users'])
            if 'admins' in response:
                new_group.add_users(admins = response['admins'])
            grp_sharing_mgr.add(group=new_group)
            # reassign group to original owner if needed
            if source_group.owner != source_gis.users.me.username:
                new_group.reassign_to(source_group.owner)
            #logger.debug(f"Created and shared item {itemid} with new group '{source_group['title']}' in target GIS.")


def update_item_data_from_config(source_item, target_item, update_dict: Dict[str, str]) -> None:
    try:
        data = source_item.get_data()

        # use the mapping_dict to update any item ids in the data
        data_str: str = json.dumps(data)
        new_url: Optional[str] = target_item.url
        new_description: Optional[str] = target_item.description
        
        for source_id, target_id in update_dict.items():
            if data_str is not None:
                data_str = data_str.replace(source_id, target_id)
            if new_url is not None:
                new_url = new_url.replace(source_id, target_id)
            if new_description is not None:
                new_description = new_description.replace(source_id, target_id)
        
        new_properties: Dict[str, Optional[str]] = {
            'url': new_url,
            'description': new_description
        }
        
        # copy thumbnail from source item to cloned item
        if target_item.type == SITE_APPLICATION_TYPE:
            with tempfile.TemporaryDirectory() as temp_dir:
                # Download the thumbnail file
                thumbnail_file_path: Optional[str] = source_item.download_thumbnail(temp_dir)

                # If a thumbnail exists, update the target item
                if thumbnail_file_path:
                    target_item.update(thumbnail=thumbnail_file_path)

        target_item.update(item_properties=new_properties, data=safe_json_loads(data_str))

        # set delete protections to match source item settings
        if source_item.can_delete:
            target_item.protect(False)
        else:
            target_item.protect(True)
        
        # update item resources
        rm_target = target_item.resources
        if rm_target is None:
            return
        target_resources: List[Dict] = rm_target.list()

        # Site Applications: remove any resources in target beginning with "draft" and ending with .json
        if target_item.type == SITE_APPLICATION_TYPE:
            for resource in target_resources:
                if resource['resource'].startswith('draft') and resource['resource'].endswith(JSON_EXTENSION):
                    rm_target.remove(resource['resource'])
        
        rm_source = source_item.resources
        source_resource_names: List[str] = []
        if rm_source is not None:
            source_resources: List[Dict] = rm_source.list()
            source_resource_names = [res['resource'] for res in source_resources]
            
            for resource in source_resources:
                file = rm_source.get(resource['resource'])
                if file is not None:
                    folder_name: str = os.path.dirname(resource['resource'])
                    res_file_name: str = os.path.basename(resource['resource'])
                    # check if resource name is config.json
                    if res_file_name == 'config.json':
                        # update config.json data to match updated item data
                        # if resource exists in target item, update it, otherwise add it
                        if any(res['resource'] == resource['resource'] for res in target_resources):
                            rm_target.update(file_name=resource['resource'], text=data_str, folder_name=folder_name)
                        else:
                            rm_target.add(file=file, file_name=resource['resource'])
                            rm_target.update(file_name=resource['resource'], text=data_str, folder_name=folder_name)

                    # check if resource is a .json file
                    elif resource['resource'].endswith(JSON_EXTENSION):
                        # update resource data from update_dict
                        resource_data = source_item.resources.get(resource['resource'])
                        resource_data_str: str = json.dumps(resource_data)
                        
                        for source_id, target_id in update_dict.items():
                            if resource_data_str is not None:
                                resource_data_str = resource_data_str.replace(source_id, target_id)

                        new_resource_data: Optional[Dict] = safe_json_loads(resource_data_str)
                        # check if resource exists in target item
                        target_resources = rm_target.list()
                        
                        # for Story maps, update draft json file, even if names are not an exact match
                        if resource['resource'].startswith('draft') and resource['resource'].endswith(JSON_EXTENSION):
                            if source_item.type == STORYMAP_TYPE:
                                for res in target_resources:
                                    if res['resource'].startswith('draft') and res['resource'].endswith(JSON_EXTENSION):
                                        rm_target.update(file_name=res['resource'], text=new_resource_data, folder_name=folder_name)
                                        break
                        elif any(res['resource'] == resource['resource'] for res in target_resources):
                            rm_target.update(file_name=resource['resource'], text=new_resource_data, folder_name=folder_name)
                        else:
                            rm_target.add(file=file, file_name=resource['resource'])
                            rm_target.update(file_name=resource['resource'], text=new_resource_data, folder_name=folder_name)
                    else:
                        # check if resource exists in target item
                        if any(res['resource'] == resource['resource'] for res in target_resources):
                            rm_target.update(file_name=resource['resource'], file=file, folder_name=folder_name)
                        else:
                            rm_target.add(file=file, file_name=resource['resource'])
            
        # remove any resources in target item that are not in source item
        target_resources = rm_target.list()

        for resource in target_resources:
            if target_item.type == SITE_APPLICATION_TYPE or target_item.type == STORYMAP_TYPE:
                # skip removing draft json files for Site Applications and Story maps
                if resource['resource'].startswith('draft') and resource['resource'].endswith(JSON_EXTENSION):
                    continue
            if resource['resource'] not in source_resource_names:
                rm_target.remove(resource['resource'])

    except Exception as e:
        logger.error(f"Error updating item data from config: {e}")
        
def palm_clone_items(target_gis: GIS, item_list: List, mapping_dict: Dict[str, str], update_dict: Dict[str, str], source_env_url: str) -> bool:
    for item in item_list:
        #workaround for Site Application items - do not preserve item id
        preserve_id: bool = False if item.type == SITE_APPLICATION_TYPE else True
        
        cloned_list = target_gis.content.clone_items(items = [item], search_existing_items = True, preserve_item_id=preserve_id, use_org_basemap=True, item_mapping=mapping_dict)
        
        if (cloned_list):
            first_item = cloned_list[0]
            cloned_item = target_gis.content.get(first_item.id)
            
            if item.type == SITE_APPLICATION_TYPE:
                # clone all images referenced in <img> tags in the Site Application data
                site_app_data = item.get_data()
                if site_app_data:
                    site_app_data = json.dumps(site_app_data)
                # find all image urls in the data  
                # ReDoS-safe: limit quantifier range to prevent catastrophic backtracking
                pattern: str = r'<img[^>]{1,500}src=\\["\']([^"\'>]{1,2000})["\']'
                img_urls: List[str] = re.findall(pattern, site_app_data)
                
                for img_url in img_urls:
                    # check if img_url is an item in source gis
                    if source_env_url in img_url:
                        try:
                            source_img_item_id: Optional[str] = safe_url_parse(img_url)
                            if not source_img_item_id:
                                continue
                            source_img_item = item._gis.content.get(source_img_item_id)
                            logger.debug(f"Processing image item with ID: {source_img_item_id}, title: {source_img_item.title if source_img_item else 'N/A'}")
                            if source_img_item:
                                # check if image already exists in target gis
                                target_img_item = target_gis.content.get(source_img_item_id)
                                if target_img_item:
                                    logger.debug(f"Image item {source_img_item_id} already exists in target GIS.")
                                else:
                                    # try searching for image by title
                                    search_results = target_gis.content.search(query=f"title:{source_img_item.title}", item_type=source_img_item.type, max_items=SEARCH_MAX_ITEMS)
                                    if search_results:
                                        target_img_item = search_results[0]
                                    else:
                                        # clone image item to target gis
                                        cloned_img_list = target_gis.content.clone_items(items = [source_img_item], search_existing_items = True, preserve_item_id=True, use_org_basemap=True, item_mapping=mapping_dict)
                                        
                                        if cloned_img_list:
                                            target_img_item = target_gis.content.get(cloned_img_list[0].id)
                                    
                                if target_img_item:
                                    # update site app data to reference new image url
                                    update_dict[source_img_item_id] = target_img_item.id
                                    share_groups(target_img_item.id, target_gis, source_img_item.id, source_img_item._gis)
                        except Exception as e:
                            logger.error(f"Error cloning image item for URL {img_url}: {e}")

                # find all pages in the site app data
                # ReDoS-safe: limit whitespace and ID length to prevent backtracking
                pattern_page: str = r'"id"\s{0,10}:\s{0,10}["\']([a-fA-F0-9]{1,64})["\']'
                page_ids: List[str] = re.findall(pattern_page, site_app_data)

                for page_id in page_ids:
                    try:
                        source_page_item = item._gis.content.get(page_id)
                        logger.debug(f"Processing page item with ID: {page_id}, title: {source_page_item.title if source_page_item else 'N/A'}")
                        if source_page_item:
                            # check if page already exists in target gis
                            target_page_item = target_gis.content.get(page_id)
                            if not target_page_item:
                                # try searching for page by title
                                search_results = target_gis.content.search(query=f"title:{source_page_item.title}", item_type=source_page_item.type, max_items=SEARCH_MAX_ITEMS)
                                if search_results:
                                    target_page_item = search_results[0]
                                else:
                                    # clone page item to target gis
                                    cloned_page_list = target_gis.content.clone_items(items = [source_page_item], search_existing_items = True, preserve_item_id=True, use_org_basemap=True, item_mapping=mapping_dict)
                                    
                                    if cloned_page_list:
                                        target_page_item = target_gis.content.get(cloned_page_list[0].id)
                                
                            if target_page_item:
                                # update mapping for page reference
                                update_dict[page_id] = target_page_item.id
                                update_item_data_from_config(source_page_item, target_page_item, update_dict)
                                share_groups(target_page_item.id, target_gis, source_page_item.id, item._gis)
                    except Exception as e:
                        logger.error(f"Error cloning page item for ID {page_id}: {e}")

            update_item_data_from_config(item, cloned_item, update_dict)
            share_groups(cloned_item.id, target_gis, item.id, item._gis)
        else:
            logger.error(f"Failed to clone item '{item.title}' with ID: {item.id}")
            return False
    
    return True


def palm_update_item(target_gis: GIS, source_item, target_item, update_dict: Dict[str, str]) -> bool:
    try:
        # Update item data
        update_item_data_from_config(source_item, target_item, update_dict)
        share_groups(target_item.id, target_gis, source_item.id, source_item._gis)
        return True
    except Exception as e:
        logger.error(f"Error updating item: {e}")
        return False

def get_clone_list(gis_source: GIS, gis_target: GIS, item_id: str, mapping_dict: Dict[str, str]) -> List:
    missing_dependencies: List[str] = get_missing_dependencies(gis_source, gis_target, item_id)
    # Remove any missing dependencies that appear in the mapping_dict
    missing_dependencies = [dep for dep in missing_dependencies if dep not in mapping_dict]
    if missing_dependencies:
        # Order missing dependencies by number of requirements
        dependency_counts: List[tuple] = []
        try:
            dep_graph = itemgraph.create_dependency_graph(gis_source, [item_id])
        except Exception:
            dep_graph = None
        for dep_id in missing_dependencies:
            try:
                node = dep_graph.get_node(dep_id)
                requirements = node.requires()
                count: int = len(requirements) if requirements else 0
                dependency_counts.append((dep_id, count))
            except Exception:
                dependency_counts.append((dep_id, 0))
        # Sort by number of requirements, ascending
        dependency_counts.sort(key=lambda x: x[1], reverse=False)
        items_to_clone: List = []
        for dep_id, count in dependency_counts:
            clone_item = gis_source.content.get(dep_id)
            if clone_item:
                items_to_clone.append(clone_item)
        return items_to_clone
    else:
        return []
        
def load_environment_config(source_env: str, target_env: str, gis_source: GIS, gis_target: GIS) -> tuple[Dict[str, str], Dict[str, str], List[str]]:
    """
    Load environment configuration and create mapping dictionaries.
    
    Returns:
        tuple: (mapping_dict, update_dict, invalid_configs)
    """
    # Define mapping dictionary for known item ID differences
    config_path: str = os.path.join(os.path.dirname(__file__), "../config/env-config.json")
    
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"env-config.json not found at {config_path}")

    with open(config_path, "r") as f:
        env_config: Dict = json.load(f)

    source_env_name: str = get_env_name_from_url(source_env)
    target_env_name: str = get_env_name_from_url(target_env)

    mapping_dict: Dict[str, str] = {} #dict to hold item ID mappings
    update_dict: Dict[str, str] = {} #dict to hold complete list of data mappings
    invalid_configs: List[str] = [] #list to hold invalid configurations
    
    for key in env_config:
        source_id: Optional[str] = env_config[key].get(source_env_name)
        target_id: Optional[str] = env_config[key].get(target_env_name)
        if source_id and target_id:
            update_dict[source_id] = target_id
            if source_id.isalnum():
                if not gis_target.content.get(target_id):
                    # log invalid config if target item does not exist
                    invalid_configs.append(f"{key}  -  {target_id}")
                    continue
                if gis_source.content.get(source_id):
                    # add to mapping dict only if source item exists
                    mapping_dict[source_id] = target_id
    
    return mapping_dict, update_dict, invalid_configs


def main() -> None:
    parser: argparse.ArgumentParser = argparse.ArgumentParser(description="Clone an ArcGIS item from source to target environment.")
    parser.add_argument('--sourceEnv', required=True, help='Source ArcGIS environment URL')
    parser.add_argument('--targetEnv', required=True, help='Target ArcGIS environment URL')
    parser.add_argument('--sourceId', required=True, help='ID of the item to promote from source')
    parser.add_argument('--targetId', required=True, help='ID of the target item')
    parser.add_argument('--clone', required=True, help='Flag to clone item (true/false)')
    
    args: argparse.Namespace = parser.parse_args()

    username: Optional[str] = os.getenv('ARCGIS_USERNAME')
    password: Optional[str] = os.getenv('ARCGIS_PASSWORD')

    if not username or not password:
        logger.error("Error: ARCGIS_USERNAME and ARCGIS_PASSWORD environment variables must be set.")
        sys.exit(1)

    # Validate that source and target environments are not the same
    try:
        validate_environments(args.sourceEnv, args.targetEnv)
    except ValueError as ve:
        logger.error(f"{ve}")
        sys.exit(1)

    # Connect to source and target GIS
    try:
        gis_source: GIS = GIS(args.sourceEnv, username, password)
        gis_target: GIS = GIS(args.targetEnv, username, password)
    except Exception as e:
        logger.error(f"Error connecting to ArcGIS environments: {e}")
        sys.exit(1)

    # Retrieve the item from source GIS
    try:
        source_item = gis_source.content.get(args.sourceId)
        if not source_item:
            logger.error(f"Item with ID {args.sourceId} not found in source environment.")
            sys.exit(1)
    except Exception as e:
        logger.error(f"Error retrieving item from source: {e}")
        sys.exit(1)

    
    try:
        mapping_dict, update_dict, invalid_configs = load_environment_config(
            args.sourceEnv, args.targetEnv, gis_source, gis_target
        )
    except FileNotFoundError as e:
        logger.error(f"Error: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Error loading environment configuration: {e}")
        sys.exit(1)

    try:
        success: bool
        if (args.clone.lower() == 'false'):
            target_item = gis_target.content.get(args.targetId)
            if not target_item:
                logger.error(f"Target item with ID {args.targetId} not found in target environment.")
                sys.exit(1)
            success = palm_update_item(gis_target, source_item, target_item, update_dict)
        else:
            success = palm_clone_items(gis_target, [source_item], mapping_dict, update_dict, args.sourceEnv)
        
        if success:
            message: str = f"Content successfully promoted! ID: {args.sourceId}, Title: {source_item.title}\n\n"
            if invalid_configs:
                message += "Warning: These configured items were not found in target environment. Please review the Portal Application Lifecycle Manager configuration to ensure that they are correctly configured, and the items ids are accurate for all environments.\n\n"
                for msg in invalid_configs:
                    message += f"{msg}\n"
            sys.stdout.write(message)
            sys.exit(0)
        else:
            logger.error(f"Item cloning failed. Item id = : {args.sourceId}")
            sys.exit(1)
    except Exception as e:
        logger.error(f"Error cloning item: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
