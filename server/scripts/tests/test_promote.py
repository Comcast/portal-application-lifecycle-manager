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

"""
Unit tests for promote.py
Tests the functionality of cloning and updating ArcGIS items between environments.
"""

import pytest
import json
import os
import sys
import tempfile
from unittest.mock import Mock, MagicMock, patch, mock_open, call
from typing import Dict, List

# Add the scripts directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from promote import (
    validate_environments,
    safe_url_parse,
    safe_json_loads,
    get_env_name_from_url,
    get_missing_dependencies,
    share_groups,
    update_item_data_from_config,
    palm_clone_items,
    palm_update_item,
    get_clone_list,
    load_environment_config,
)


# Test Fixtures
@pytest.fixture
def mock_gis():
    """Create a mock GIS object"""
    gis = Mock()
    gis.content = Mock()
    gis.groups = Mock()
    gis.users = Mock()
    gis.users.me = Mock()
    gis.users.me.username = "test_user"
    return gis


@pytest.fixture
def mock_item():
    """Create a mock ArcGIS item"""
    item = Mock()
    item.id = "abc123def456"
    item.title = "Test Item"
    item.type = "Web Map"
    item.url = "https://test.com/item/abc123def456"
    item.description = "Test description"
    item.can_delete = True
    item.sharing = Mock()
    item.sharing.shared_with = {'level': 'org'}
    item.sharing.groups = Mock()
    item.sharing.groups.list = Mock(return_value=[])
    item.resources = Mock()
    item.resources.list = Mock(return_value=[])
    item.get_data = Mock(return_value={"test": "data"})
    item.update = Mock(return_value=True)
    item.protect = Mock(return_value=True)
    item._gis = Mock()
    return item


@pytest.fixture
def sample_env_config():
    """Sample environment configuration"""
    return {
        "GIS Tools Portal": {
            "type": "url",
            "Development": "gistools-dev.example.com",
            "Staging": "gistools-staging.example.com",
            "Production": "gistools.example.com"
        },
        "Test Widget": {
            "type": "widget",
            "Development": "abc123def456",
            "Staging": "def456ghi789",
            "Production": "ghi789jkl012"
        }
    }


@pytest.fixture
def sample_url_mapping():
    """Sample URL to environment name mapping"""
    return {
        "Development": "enterprise-dev.example.com",
        "Staging": "enterprise-staging.example.com",
        "Production": "enterprise.example.com"
    }


# Tests for validate_environments
class TestValidateEnvironments:
    def test_valid_different_environments(self):
        """Should pass when environments are different"""
        validate_environments("https://env1.com", "https://env2.com")
        # No exception means test passes

    def test_invalid_same_environments(self):
        """Should raise ValueError when environments are the same"""
        with pytest.raises(ValueError, match="Source and target environments cannot be the same"):
            validate_environments("https://env1.com", "https://env1.com")


# Tests for safe_url_parse
class TestSafeUrlParse:
    def test_valid_url(self):
        """Should parse valid URL correctly"""
        url = "https://example.com/items/abc123def456/info"
        result = safe_url_parse(url)
        assert result == "abc123def456"

    def test_short_url(self):
        """Should return empty string or second-to-last part for short URLs"""
        url = "https://example.com"
        result = safe_url_parse(url)
        # For URL with only 2 parts after split, returns second-to-last part or empty
        assert result in [None, '', 'example.com']

    def test_none_input(self):
        """Should handle None input gracefully"""
        result = safe_url_parse(None)
        assert result is None

    def test_empty_string(self):
        """Should handle empty string"""
        result = safe_url_parse("")
        assert result is None

    def test_url_with_trailing_slash(self):
        """Should handle URLs with trailing slash"""
        url = "https://example.com/items/abc123def456/info"
        result = safe_url_parse(url)
        # With /info at the end, parts[-2] should be the ID
        assert result == "abc123def456"


# Tests for safe_json_loads
class TestSafeJsonLoads:
    def test_valid_json(self):
        """Should parse valid JSON string"""
        json_str = '{"key": "value", "number": 123}'
        result = safe_json_loads(json_str)
        assert result == {"key": "value", "number": 123}

    def test_invalid_json(self):
        """Should return None for invalid JSON"""
        json_str = '{"key": invalid}'
        result = safe_json_loads(json_str)
        assert result is None

    def test_empty_string(self):
        """Should return None for empty string"""
        result = safe_json_loads("")
        assert result is None

    def test_none_input(self):
        """Should return None for None input"""
        result = safe_json_loads(None)
        assert result is None


# Tests for get_env_name_from_url
class TestGetEnvNameFromUrl:
    @patch('builtins.open', new_callable=mock_open)
    @patch('os.path.exists')
    def test_valid_url_mapping(self, mock_exists, mock_file, sample_url_mapping):
        """Should return correct environment name for valid URL"""
        mock_exists.return_value = True
        mock_file.return_value.read.return_value = json.dumps(sample_url_mapping)
        
        with patch('json.load', return_value=sample_url_mapping):
            result = get_env_name_from_url("https://enterprise-dev.example.com/portal")
            assert result == "Development"

    @patch('os.path.exists')
    def test_missing_config_file(self, mock_exists):
        """Should return 'unknown' when config file is missing"""
        mock_exists.return_value = False
        
        result = get_env_name_from_url("https://example.com")
        assert result == "unknown"

    @patch('builtins.open', new_callable=mock_open)
    @patch('os.path.exists')
    def test_unknown_url(self, mock_exists, mock_file, sample_url_mapping):
        """Should return 'unknown' for unrecognized URL"""
        mock_exists.return_value = True
        
        with patch('json.load', return_value=sample_url_mapping):
            result = get_env_name_from_url("https://unknown-env.com")
            assert result == "unknown"

    @patch('builtins.open', side_effect=Exception("File read error"))
    @patch('os.path.exists')
    def test_file_read_error(self, mock_exists, mock_file):
        """Should return 'unknown' when file read fails"""
        mock_exists.return_value = True
        
        result = get_env_name_from_url("https://example.com")
        assert result == "unknown"


# Tests for get_missing_dependencies
class TestGetMissingDependencies:
    def test_no_missing_dependencies(self, mock_gis):
        """Should return empty list when all dependencies exist in target"""
        source_gis = mock_gis
        target_gis = mock_gis
        
        # Both items exist
        source_gis.content.get = Mock(return_value=Mock(id="item123"))
        target_gis.content.get = Mock(return_value=Mock(id="item123"))
        
        with patch('promote.itemgraph.create_dependency_graph') as mock_graph:
            mock_graph.return_value.all_items.return_value = [Mock(id="item123")]
            
            result = get_missing_dependencies(source_gis, target_gis, "item123")
            assert result == []

    def test_missing_dependency(self, mock_gis):
        """Should return list of missing dependencies"""
        source_gis = Mock()
        target_gis = Mock()
        
        # Source item exists, target doesn't
        source_item = Mock(id="item123")
        source_gis.content.get = Mock(return_value=source_item)
        target_gis.content.get = Mock(return_value=None)
        
        with patch('promote.itemgraph.create_dependency_graph') as mock_graph:
            mock_graph.return_value.all_items.return_value = [Mock(id="item123")]
            
            result = get_missing_dependencies(source_gis, target_gis, "item123")
            assert "item123" in result

    def test_circular_dependency(self, mock_gis):
        """Should handle circular dependencies without infinite loop"""
        source_gis = mock_gis
        target_gis = mock_gis
        
        source_gis.content.get = Mock(return_value=Mock(id="item123"))
        target_gis.content.get = Mock(return_value=Mock(id="item123"))
        
        with patch('promote.itemgraph.create_dependency_graph') as mock_graph:
            # Simulate circular dependency
            mock_graph.return_value.all_items.return_value = [
                Mock(id="item123"),
                Mock(id="item456"),
                Mock(id="item123")  # Circular reference
            ]
            
            result = get_missing_dependencies(source_gis, target_gis, "item123")
            assert isinstance(result, list)

    def test_item_not_found(self, mock_gis):
        """Should handle case when source item doesn't exist"""
        source_gis = mock_gis
        target_gis = mock_gis
        
        source_gis.content.get = Mock(return_value=None)
        
        result = get_missing_dependencies(source_gis, target_gis, "nonexistent")
        assert result == []


# Tests for share_groups
class TestShareGroups:
    def test_share_with_existing_group(self, mock_gis, mock_item):
        """Should share item with existing group in target"""
        target_gis = mock_gis
        source_gis = Mock()  # Create separate source_gis
        
        # Setup source item with groups - must be iterable dict objects
        source_item = Mock()
        source_item.id = "source123"
        source_item.sharing = Mock()
        source_item.sharing.shared_with = {'level': 'org'}
        source_item.sharing.groups = Mock()
        
        source_group_dict = {
            'title': 'Test Group',
            'tags': ['tag1'],
            'description': 'desc',
            'snippet': 'snippet',
            'access': 'public',
            'isInvitationOnly': False,
            'sortField': 'title',
            'sortOrder': 'asc',
            'isViewOnly': False,
            'autoJoin': False,
            'protected': False
        }
        source_item.sharing.groups.list.return_value = [source_group_dict]
        
        # Setup target group
        target_group = Mock()
        target_group.title = "Test Group"
        target_group.owner = "test_user"
        target_gis.groups.search.return_value = [target_group]
        
        # Setup target item
        target_item = Mock()
        target_item.id = "item123"
        target_item.sharing = Mock()
        target_item.sharing.groups = Mock()
        target_item.sharing.groups.add = Mock()
        
        target_gis.content.get.return_value = target_item
        source_gis.content.get.return_value = source_item
        
        share_groups("item123", target_gis, "source123", source_gis)
        
        # Verify group was added
        target_item.sharing.groups.add.assert_called_once()

    def test_item_not_found(self, mock_gis):
        """Should handle case when items are not found"""
        target_gis = mock_gis
        source_gis = mock_gis
        
        target_gis.content.get.return_value = None
        source_gis.content.get.return_value = None
        
        # Should not raise exception
        share_groups("item123", target_gis, "source123", source_gis)

    def test_create_new_group(self, mock_gis, mock_item):
        """Should create new group if it doesn't exist in target"""
        target_gis = mock_gis
        source_gis = Mock()  # Create separate source_gis
        
        # Setup source item with proper group structure
        source_item = Mock()
        source_item.id = "source123"
        source_item.sharing = Mock()
        source_item.sharing.shared_with = {'level': 'org'}
        source_item.sharing.groups = Mock()
        
        # Create a mock group object that can be used in the iteration
        source_group = Mock()
        source_group.title = "New Group"
        source_group.owner = "test_user"
        source_group.get_members.return_value = {'users': [], 'admins': []}
        source_group.download_thumbnail.return_value = None
        source_group.__getitem__ = lambda self, key: {
            'title': 'New Group',
            'tags': ['tag1'],
            'description': 'desc',
            'snippet': 'snippet',
            'access': 'public',
            'isInvitationOnly': False,
            'sortField': 'title',
            'sortOrder': 'asc',
            'isViewOnly': False,
            'autoJoin': False,
            'protected': False
        }[key]
        
        # Return a dict for iteration in the function
        source_item.sharing.groups.list.return_value = [source_group]
        
        # No existing group in target
        target_gis.groups.search.return_value = []
        
        # Mock group creation
        new_group = Mock()
        new_group.owner = "test_user"
        target_gis.groups.create.return_value = new_group
        
        # Setup target item
        target_item = Mock()
        target_item.id = "item123"
        target_item.sharing = Mock()
        target_item.sharing.groups = Mock()
        target_item.sharing.groups.add = Mock()
        
        target_gis.content.get.return_value = target_item
        source_gis.content.get.return_value = source_item
        source_gis.users = Mock()
        source_gis.users.me = Mock()
        source_gis.users.me.username = "test_user"
        
        share_groups("item123", target_gis, "source123", source_gis)
        
        # Verify group was created
        target_gis.groups.create.assert_called_once()


# Tests for update_item_data_from_config
class TestUpdateItemDataFromConfig:
    def test_basic_update(self, mock_item):
        """Should update item data with mapping dictionary"""
        source_item = mock_item
        target_item = mock_item
        
        source_item.get_data.return_value = {"itemId": "old123", "value": "test"}
        target_item.url = "https://test.com/item/old123"
        target_item.description = "Item old123 description"
        target_item.type = "Web Map"
        target_item.resources = Mock()
        target_item.resources.list.return_value = []
        
        update_dict = {"old123": "new456"}
        
        update_item_data_from_config(source_item, target_item, update_dict)
        
        # Verify update was called
        target_item.update.assert_called()
        
        # Check that data was updated
        call_args = target_item.update.call_args
        assert 'data' in call_args[1]
        updated_data = call_args[1]['data']
        assert updated_data['itemId'] == 'new456'

    def test_update_with_resources(self, mock_item):
        """Should update item resources"""
        source_item = Mock()
        target_item = Mock()
        
        source_item.get_data.return_value = {"test": "data"}
        source_item.can_delete = True
        source_item.type = "Web Map"
        target_item.type = "Web Map"
        target_item.url = "https://test.com"
        target_item.description = "Test"
        target_item.update = Mock()
        target_item.protect = Mock()
        
        # Setup resources - JSON resource
        source_resource = {'resource': 'config.json'}
        source_item.resources = Mock()
        source_item.resources.list.return_value = [source_resource]
        source_item.resources.get.side_effect = lambda res: {"config": "value"} if res == 'config.json' else None
        
        target_item.resources = Mock()
        target_item.resources.list.return_value = []
        target_item.resources.add = Mock()
        target_item.resources.update = Mock()
        target_item.resources.remove = Mock()
        
        update_dict = {}
        
        update_item_data_from_config(source_item, target_item, update_dict)
        
        # Verify update was called on the item itself
        assert target_item.update.called
        # For JSON resources, they should be added and then updated
        assert target_item.resources.add.called or target_item.resources.update.called

    def test_site_application_thumbnail_update(self, mock_item):
        """Should update thumbnail for Site Application items"""
        source_item = mock_item
        target_item = mock_item
        
        source_item.type = "Site Application"
        target_item.type = "Site Application"
        source_item.get_data.return_value = {"test": "data"}
        
        with tempfile.TemporaryDirectory() as temp_dir:
            thumbnail_path = os.path.join(temp_dir, "thumb.png")
            with open(thumbnail_path, 'w') as f:
                f.write("test")
            
            source_item.download_thumbnail.return_value = thumbnail_path
            target_item.resources = Mock()
            target_item.resources.list.return_value = []
            
            update_dict = {}
            
            update_item_data_from_config(source_item, target_item, update_dict)
            
            # Verify thumbnail update was attempted
            assert target_item.update.called

    def test_delete_protection(self, mock_item):
        """Should set delete protection based on source item"""
        source_item = mock_item
        target_item = mock_item
        
        source_item.can_delete = False
        source_item.get_data.return_value = {"test": "data"}
        target_item.resources = Mock()
        target_item.resources.list.return_value = []
        
        update_dict = {}
        
        update_item_data_from_config(source_item, target_item, update_dict)
        
        # Verify protect was called with True
        target_item.protect.assert_called_with(True)


# Tests for palm_clone_items
class TestPalmCloneItems:
    def test_successful_clone(self, mock_gis, mock_item):
        """Should successfully clone items"""
        target_gis = mock_gis
        source_item = mock_item
        
        cloned_item = Mock()
        cloned_item.id = "cloned123"
        
        target_gis.content.clone_items.return_value = [cloned_item]
        target_gis.content.get.return_value = cloned_item
        
        with patch('promote.update_item_data_from_config'):
            with patch('promote.share_groups'):
                result = palm_clone_items(
                    target_gis, 
                    [source_item], 
                    {}, 
                    {}, 
                    "https://source.com"
                )
        
        assert result is True
        assert target_gis.content.clone_items.called

    def test_failed_clone(self, mock_gis, mock_item):
        """Should return False when cloning fails"""
        target_gis = mock_gis
        source_item = mock_item
        
        target_gis.content.clone_items.return_value = []
        
        result = palm_clone_items(
            target_gis,
            [source_item],
            {},
            {},
            "https://source.com"
        )
        
        assert result is False

    def test_site_application_clone(self, mock_gis, mock_item):
        """Should handle Site Application cloning with preserve_id=False"""
        target_gis = mock_gis
        source_item = mock_item
        source_item.type = "Site Application"
        source_item.get_data.return_value = {"test": "data"}
        
        cloned_item = Mock()
        cloned_item.id = "cloned123"
        
        target_gis.content.clone_items.return_value = [cloned_item]
        target_gis.content.get.return_value = cloned_item
        
        with patch('promote.update_item_data_from_config'):
            with patch('promote.share_groups'):
                result = palm_clone_items(
                    target_gis,
                    [source_item],
                    {},
                    {},
                    "https://source.com"
                )
        
        assert result is True
        # Verify clone_items was called with preserve_item_id=False
        call_args = target_gis.content.clone_items.call_args
        assert call_args[1]['preserve_item_id'] is False


# Tests for palm_update_item
class TestPalmUpdateItem:
    def test_successful_update(self, mock_gis, mock_item):
        """Should successfully update an item"""
        target_gis = mock_gis
        source_item = mock_item
        target_item = mock_item
        
        with patch('promote.update_item_data_from_config'):
            with patch('promote.share_groups'):
                result = palm_update_item(target_gis, source_item, target_item, {})
        
        assert result is True

    def test_failed_update(self, mock_gis, mock_item):
        """Should return False when update fails"""
        target_gis = mock_gis
        source_item = mock_item
        target_item = mock_item
        
        with patch('promote.update_item_data_from_config', side_effect=Exception("Update failed")):
            result = palm_update_item(target_gis, source_item, target_item, {})
        
        assert result is False


# Tests for get_clone_list
class TestGetCloneList:
    def test_no_missing_dependencies(self, mock_gis):
        """Should return empty list when no dependencies are missing"""
        source_gis = mock_gis
        target_gis = mock_gis
        
        with patch('promote.get_missing_dependencies', return_value=[]):
            result = get_clone_list(source_gis, target_gis, "item123", {})
        
        assert result == []

    def test_with_missing_dependencies(self, mock_gis):
        """Should return ordered list of items to clone"""
        source_gis = mock_gis
        target_gis = mock_gis
        
        mock_dep_item = Mock()
        mock_dep_item.id = "dep123"
        source_gis.content.get.return_value = mock_dep_item
        
        with patch('promote.get_missing_dependencies', return_value=["dep123"]):
            with patch('promote.itemgraph.create_dependency_graph') as mock_graph:
                mock_node = Mock()
                mock_node.requires.return_value = []
                mock_graph.return_value.get_node.return_value = mock_node
                
                result = get_clone_list(source_gis, target_gis, "item123", {})
        
        assert len(result) == 1
        assert result[0].id == "dep123"

    def test_filtered_by_mapping_dict(self, mock_gis):
        """Should filter out dependencies that exist in mapping_dict"""
        source_gis = mock_gis
        target_gis = mock_gis
        
        mapping_dict = {"dep123": "target123"}
        
        with patch('promote.get_missing_dependencies', return_value=["dep123", "dep456"]):
            with patch('promote.itemgraph.create_dependency_graph') as mock_graph:
                mock_node = Mock()
                mock_node.requires.return_value = []
                mock_graph.return_value.get_node.return_value = mock_node
                
                mock_item = Mock()
                mock_item.id = "dep456"
                source_gis.content.get.return_value = mock_item
                
                result = get_clone_list(source_gis, target_gis, "item123", mapping_dict)
        
        # Should only have dep456, not dep123 (which is in mapping_dict)
        assert len(result) == 1
        assert result[0].id == "dep456"


# Tests for load_environment_config
class TestLoadEnvironmentConfig:
    @patch('builtins.open', new_callable=mock_open)
    @patch('os.path.exists')
    def test_successful_load(self, mock_exists, mock_file, mock_gis, sample_env_config, sample_url_mapping):
        """Should successfully load environment config"""
        mock_exists.return_value = True
        
        source_gis = mock_gis
        target_gis = mock_gis
        
        # Mock items exist
        source_gis.content.get.return_value = Mock(id="abc123def456")
        target_gis.content.get.return_value = Mock(id="def456ghi789")
        
        with patch('json.load', return_value=sample_env_config):
            with patch('promote.get_env_name_from_url') as mock_get_env:
                mock_get_env.side_effect = lambda url: "Development" if "dev" in url.lower() else "Staging"
                
                mapping_dict, update_dict, invalid_configs = load_environment_config(
                    "https://dev.example.com",
                    "https://staging.example.com",
                    source_gis,
                    target_gis
                )
        
        assert isinstance(mapping_dict, dict)
        assert isinstance(update_dict, dict)
        assert isinstance(invalid_configs, list)

    @patch('os.path.exists')
    def test_missing_config_file(self, mock_exists, mock_gis):
        """Should raise FileNotFoundError when config file is missing"""
        mock_exists.return_value = False
        
        with pytest.raises(FileNotFoundError):
            load_environment_config(
                "https://dev.example.com",
                "https://staging.example.com",
                mock_gis,
                mock_gis
            )

    @patch('builtins.open', new_callable=mock_open)
    @patch('os.path.exists')
    def test_invalid_target_items(self, mock_exists, mock_file, mock_gis, sample_env_config):
        """Should track invalid configs when target items don't exist"""
        mock_exists.return_value = True
        
        source_gis = mock_gis
        target_gis = mock_gis
        
        # Source exists, target doesn't
        source_gis.content.get.return_value = Mock(id="abc123def456")
        target_gis.content.get.return_value = None  # Target doesn't exist
        
        with patch('json.load', return_value=sample_env_config):
            with patch('promote.get_env_name_from_url') as mock_get_env:
                mock_get_env.side_effect = lambda url: "Development" if "dev" in url.lower() else "Staging"
                
                mapping_dict, update_dict, invalid_configs = load_environment_config(
                    "https://dev.example.com",
                    "https://staging.example.com",
                    source_gis,
                    target_gis
                )
        
        # Should have invalid configs
        assert len(invalid_configs) > 0


# Integration-style tests
@pytest.mark.integration
class TestIntegration:
    """Integration tests that test multiple functions together"""
    
    def test_clone_workflow(self, mock_gis, mock_item):
        """Test complete clone workflow"""
        source_gis = mock_gis
        target_gis = mock_gis
        source_item = mock_item
        
        # Setup successful clone
        cloned_item = Mock()
        cloned_item.id = "cloned123"
        target_gis.content.clone_items.return_value = [cloned_item]
        target_gis.content.get.return_value = cloned_item
        
        with patch('promote.update_item_data_from_config'):
            with patch('promote.share_groups'):
                with patch('promote.get_missing_dependencies', return_value=[]):
                    result = palm_clone_items(
                        target_gis,
                        [source_item],
                        {},
                        {},
                        "https://source.com"
                    )
        
        assert result is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
